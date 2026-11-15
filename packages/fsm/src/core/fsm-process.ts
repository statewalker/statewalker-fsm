import { bindMethods, FsmBaseClass } from "./fsm-base-class.ts";
import {
  dispatchSteps,
  dumpSteps,
  type FsmEngine,
  FsmStep,
  restoreSteps,
  runAsync,
  shutdownSteps,
  updateSteps,
} from "./fsm-controller.ts";
import { FsmState, type FsmStateDump, type FsmStateHandler } from "./fsm-state.ts";
import type { FsmStateConfig } from "./fsm-state-config.ts";
import { FsmStateDescriptor } from "./fsm-state-descriptor.ts";
import { getSubstateTarget, resolveTargetStateKey, STATUS_LEAF } from "./fsm-traversal.ts";

// The status constants live with the shared traversal algorithm; re-exported
// here so existing `import { STATUS_LEAF } from "./fsm-process.ts"` keeps working.
export {
  STATUS_ENTER,
  STATUS_EXIT,
  STATUS_FINISHED,
  STATUS_FIRST,
  STATUS_LAST,
  STATUS_LEAF,
  STATUS_NEXT,
  STATUS_NONE,
} from "./fsm-traversal.ts";

/** A process-level handler (`onStateCreate` / `onStateError`). */
export type FsmProcessHandler = (process: FsmProcess, ...args: unknown[]) => void | Promise<void>;

/** Serialized form of the whole machine: status, last event, and the root→leaf state stack. */
export type FsmProcessDump = Record<string, unknown> & {
  status: number;
  event?: string;
  stack: FsmStateDump[];
};

export type FsmProcessDumpHandler = (
  process: FsmProcess,
  dump: FsmProcessDump,
) => void | Promise<void>;

/**
 * The running state machine — owner of the active-state stack and the traversal.
 *
 * This is the engine: given a compiled config it drives the enter/exit walk in
 * response to events, so callers reason in terms of states and events, not manual
 * stack bookkeeping. `dispatch(event)` advances the machine to the next resting leaf;
 * `shutdown(event?)` unwinds every active state; `state` is the current leaf;
 * `onStateCreate(handler)` is the primary extension point (fires once per created
 * state — attach that state's hooks there); and `dump()` / `restore(dump)` snapshot
 * and rehydrate the whole stack. Typical use: `new FsmProcess(config)`, register
 * `onStateCreate`, then `dispatch("")` to enter the initial state and
 * `dispatch(event)` for each subsequent event.
 *
 * `FsmProcessSync` is the synchronous twin — same traversal, no promises. Both
 * are thin shells over one controller (`fsm-controller.ts`): this one awaits
 * each of its steps.
 */
export class FsmProcess extends FsmBaseClass implements FsmEngine<FsmState> {
  state?: FsmState;
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
  /** @internal The one step record its controller programs refill (see `FsmStep`). */
  readonly _step = new FsmStep();
  /** @internal See `FsmEngine._sync`. */
  readonly _sync = false;
  private _idleWaiters: (() => void)[] = [];

  constructor(config: FsmStateConfig) {
    super();
    this.rootDescriptor = FsmStateDescriptor.build(config);
    this.config = config;
    bindMethods(this, "dispatch", "shutdown", "dump", "restore", "whenIdle");
  }

  /**
   * Force-exit the whole stack (root last), running each state's `onExit`; ends the
   * machine. Pending queued events are discarded and later `dispatch` calls are
   * no-ops (until a `restore`).
   *
   * Like a re-entrant `dispatch`, a shutdown requested while the machine is busy —
   * from a handler, or while a dispatch or another shutdown is in progress — only
   * records the request and resolves at once (so awaiting it inside a handler can
   * never deadlock). The running dispatch then unwinds the stack as soon as the
   * current handler returns; every entered state is exited exactly once, and a
   * state still being created is discarded. Await `whenIdle()` to wait for the
   * unwinding to finish.
   */
  async shutdown(event?: string): Promise<void> {
    return runAsync(shutdownSteps(this, event));
  }

  /** Resolves once no dispatch or shutdown is in progress. */
  whenIdle(): Promise<void> {
    if (!this.running && !this._unwinding) return Promise.resolve();
    return new Promise((resolve) => this._idleWaiters.push(resolve));
  }

  /** @internal Release the `whenIdle` waiters once nothing is in progress. */
  _notifyIdle() {
    if (this.running || this._unwinding) return;
    const waiters = this._idleWaiters;
    this._idleWaiters = [];
    for (const resolve of waiters) resolve();
  }

  /**
   * Feed an event to the machine and run the enter/exit cycle until it rests on a
   * leaf (`status & mask`) or finishes.
   *
   * If a dispatch is already running (e.g. an `onEnter` handler dispatches
   * synchronously), the event is appended to the `nextEvents` FIFO queue and applied
   * — in order, none dropped — when the current run settles; runs never nest, and
   * the re-entrant call resolves at once. Events sent to a finished (or shutting
   * down) machine are ignored. Returns `false` once the machine has finished, `true`
   * otherwise.
   */
  async dispatch(event: string): Promise<boolean> {
    return runAsync(dispatchSteps(this, event));
  }

  /**
   * Snapshot the machine to a plain object: `{ status, event, stack }` where the
   * stack is root→leaf, each entry carrying whatever its `dump` hooks recorded.
   */
  async dump(...args: unknown[]): Promise<FsmProcessDump> {
    return runAsync(dumpSteps(this, args));
  }

  /**
   * Rebuild the machine from a `dump`: recreate each state in the stack (firing
   * `onStateCreate`) and replay its `restore` hooks, leaving the process resumable
   * from where it was snapshotted. The current stack is replaced as-is (its
   * `onExit` handlers do not run — call `shutdown()` first to unwind it).
   */
  async restore(dump: FsmProcessDump, ...args: unknown[]) {
    await runAsync(restoreSteps(this, "FsmProcess", dump, args));
    return this;
  }

  /** Primary extension point: fires once for every state the machine creates. */
  onStateCreate(handler: FsmStateHandler) {
    return this._addHandler("onStateCreate", handler, true);
  }

  onStateError(handler: (state: FsmState, error: unknown) => void | Promise<void>) {
    return this._addHandler("onStateError", handler);
  }

  async _handleStateError(state: FsmState, error: Error | unknown) {
    await this._runHandler("onStateError", state, error);
    await this._handleError(error);
  }

  async _newState(
    parent: FsmState | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined,
  ) {
    const state = new FsmState(this, parent, key, descriptor);
    await this._runHandler("onStateCreate", state);
    return state;
  }

  async _getSubstate(parent: FsmState | undefined, prevStateKey: string | undefined) {
    const key = resolveTargetStateKey(parent, prevStateKey, this.event);
    if (key === undefined) return;
    return this._newSubstate(parent, key);
  }

  async _newSubstate(parent: FsmState | undefined, toState: string) {
    const { descriptor } = getSubstateTarget(parent, toState);
    return this._newState(parent, toState, descriptor);
  }

  /**
   * One step of the traversal (see `fsm-traversal.ts`): create the next state, if
   * any, and update `state` / `status`. Returns `false` when finished.
   */
  async _update() {
    return runAsync(updateSteps(this));
  }
}
