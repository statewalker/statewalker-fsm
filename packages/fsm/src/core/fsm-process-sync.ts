import { bindMethods, FsmBaseClassSync } from "./fsm-base-class.ts";
import {
  dispatchSteps,
  dumpSteps,
  type FsmEngine,
  restoreSteps,
  runSync,
  shutdownSteps,
  updateSteps,
} from "./fsm-controller.ts";
import type { FsmProcessDump } from "./fsm-process.ts";
import type { FsmStateConfig } from "./fsm-state-config.ts";
import { FsmStateDescriptor } from "./fsm-state-descriptor.ts";
import { FsmStateSync } from "./fsm-state-sync.ts";
import { STATUS_LEAF } from "./fsm-traversal.ts";

/** A process-level synchronous handler (`onStateCreate`). */
export type FsmProcessSyncStateHandler = (state: FsmStateSync) => void;

/**
 * Synchronous twin of `FsmProcess` — the same HFSM traversal, with no promises.
 *
 * Use it when every handler is synchronous (UI reducers, parsers, game loops,
 * tests, server-side rendering…) and you want the machine to have moved by the
 * time `dispatch` returns. The controller is shared with `FsmProcess` (see
 * `fsm-controller.ts`; this engine calls each of its steps directly), so both
 * engines visit states in exactly the same order, and dumps are
 * interchangeable between them.
 *
 * Differences from `FsmProcess`: `dispatch` / `shutdown` / `dump` / `restore`
 * return their results directly; handlers must not return promises (that is
 * reported as a `TypeError` via `onStateError`).
 */
export class FsmProcessSync extends FsmBaseClassSync implements FsmEngine<FsmStateSync> {
  state?: FsmStateSync;
  event?: string;
  nextEvents: string[] = [];
  running: boolean = false;
  mask: number = STATUS_LEAF;
  status: number = 0;
  config: FsmStateConfig;
  rootDescriptor: FsmStateDescriptor;
  /**
   * Optional filter checked as each event is taken off the queue, against the state
   * the machine is in at that moment. An event it rejects is dropped without effect.
   * The runners set it to `isStateTransitionEnabled`, so an event queued while the
   * machine was busy is checked where it lands, not where it was queued.
   */
  eventFilter?: (event: string) => boolean;
  /** @internal A shutdown requested while busy; applied by the dispatch loop. */
  _pendingShutdown?: { event?: string };
  /** @internal `true` while the stack is being unwound. */
  _unwinding = false;
  /** @internal See `FsmEngine._sync`. */
  readonly _sync = true;

  constructor(config: FsmStateConfig) {
    super();
    this.rootDescriptor = FsmStateDescriptor.build(config);
    this.config = config;
    bindMethods(this, "dispatch", "shutdown", "dump", "restore");
  }

  /**
   * Force-exit the whole stack (root last), running each state's `onExit`; ends the
   * machine. Pending queued events are discarded.
   *
   * Called while the machine is busy (from a handler during a dispatch), the
   * shutdown is only recorded; the running dispatch unwinds the stack as soon as
   * the current handler returns, so every entered state is exited exactly once and
   * a state still being created is discarded. A shutdown requested while one is
   * already unwinding is a no-op. Same semantics as `FsmProcess.shutdown`.
   */
  shutdown(event?: string): void {
    runSync(shutdownSteps(this, event));
  }

  /** @internal The sync engine has no idle waiters. */
  _notifyIdle(): void {}

  /**
   * Feed an event and run the enter/exit cycle until the machine rests on a leaf
   * (`status & mask`) or finishes. Re-entrant calls (from handlers) are queued and
   * applied in order once the current run settles; they return `true` at once.
   * Returns `false` once finished.
   */
  dispatch(event: string): boolean {
    return runSync(dispatchSteps(this, event));
  }

  /** Snapshot the machine: `{ status, event, stack }` (stack root→leaf). */
  dump(...args: unknown[]): FsmProcessDump {
    return runSync(dumpSteps(this, args));
  }

  /**
   * Rebuild the machine from a dump (from either engine): recreate each state
   * (firing `onStateCreate`) and replay its `restore` hooks. The current stack is
   * replaced as-is — call `shutdown()` first to run its `onExit` handlers.
   */
  restore(dump: FsmProcessDump, ...args: unknown[]): this {
    runSync(restoreSteps(this, "FsmProcessSync", dump, args));
    return this;
  }

  /** Primary extension point: fires once for every state the machine creates. */
  onStateCreate(handler: FsmProcessSyncStateHandler) {
    return this._addHandler("onStateCreate", handler, true);
  }

  onStateError(handler: (state: FsmStateSync, error: unknown) => void) {
    return this._addHandler("onStateError", handler);
  }

  _handleStateError(state: FsmStateSync, error: Error | unknown): void {
    this._runHandler("onStateError", state, error);
    this._handleError(error);
  }

  _newState(
    parent: FsmStateSync | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined,
  ): FsmStateSync {
    const state = new FsmStateSync(this, parent, key, descriptor);
    this._runHandler("onStateCreate", state);
    return state;
  }

  /** One traversal step (see `fsm-traversal.ts`). Returns `false` when finished. */
  _update(): boolean {
    return runSync(updateSteps(this));
  }
}
