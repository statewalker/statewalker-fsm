import { bindMethods, FsmBaseClassSync } from "./fsm-base-class.ts";
import type { FsmProcessDump } from "./fsm-process.ts";
import type { FsmStateDump } from "./fsm-state.ts";
import type { FsmStateConfig } from "./fsm-state-config.ts";
import { FsmStateDescriptor } from "./fsm-state-descriptor.ts";
import { FsmStateSync } from "./fsm-state-sync.ts";
import {
  getNextStateTarget,
  getSubstateTarget,
  STATUS_ENTER,
  STATUS_EXIT,
  STATUS_FINISHED,
  STATUS_LEAF,
  settleStep,
} from "./fsm-traversal.ts";

/** A process-level synchronous handler (`onStateCreate`). */
export type FsmProcessSyncStateHandler = (state: FsmStateSync) => void;

/**
 * Synchronous twin of `FsmProcess` — the same HFSM traversal, with no promises.
 *
 * Use it when every handler is synchronous (UI reducers, parsers, game loops,
 * tests, server-side rendering…) and you want the machine to have moved by the
 * time `dispatch` returns. The algorithm is shared with `FsmProcess` (see
 * `fsm-traversal.ts`), so both engines visit states in exactly the same order,
 * and dumps are interchangeable between them.
 *
 * Differences from `FsmProcess`: `dispatch` / `shutdown` / `dump` / `restore`
 * return their results directly; handlers must not return promises (that is
 * reported as a `TypeError` via `onStateError`).
 */
export class FsmProcessSync extends FsmBaseClassSync {
  state?: FsmStateSync;
  event?: string;
  nextEvents: string[] = [];
  running: boolean = false;
  mask: number = STATUS_LEAF;
  status: number = 0;
  config: FsmStateConfig;
  rootDescriptor: FsmStateDescriptor;
  private _shuttingDown = false;

  constructor(config: FsmStateConfig) {
    super();
    this.rootDescriptor = FsmStateDescriptor.build(config);
    this.config = config;
    bindMethods(this, "dispatch", "shutdown", "dump", "restore");
  }

  /**
   * Force-exit the whole stack (root last), running each state's `onExit`; ends the
   * machine. Pending queued events are discarded. A shutdown requested while one
   * is already unwinding (e.g. from an `onExit` handler) is a no-op.
   */
  shutdown(event?: string): void {
    if (this._shuttingDown) return;
    this._shuttingDown = true;
    try {
      this.status = STATUS_FINISHED;
      this.nextEvents.length = 0;
      while (this.state) {
        this.event = event;
        this.status = STATUS_FINISHED;
        this.state._runHandler("onExit", this.state);
        this.state = this.state.parent;
      }
    } finally {
      this._shuttingDown = false;
    }
  }

  /**
   * Feed an event and run the enter/exit cycle until the machine rests on a leaf
   * (`status & mask`) or finishes. Re-entrant calls (from handlers) are queued and
   * applied in order once the current run settles. Returns `false` once finished.
   */
  dispatch(event: string): boolean {
    if (this.status & STATUS_FINISHED) return false;
    this.nextEvents.push(event);
    if (!this.running) {
      this.running = true;
      try {
        while (this.nextEvents.length > 0 && !(this.status & STATUS_FINISHED)) {
          this.event = this.nextEvents.shift();
          while (true) {
            if (this.status & STATUS_EXIT) {
              this.state?._runHandler("onExit", this.state);
            }
            if (!this._update()) break;
            if (this.status & STATUS_ENTER) {
              this.state?._runHandler("onEnter", this.state);
            }
            if (this.status & this.mask) break;
          }
        }
      } finally {
        this.running = false;
        if (this.status & STATUS_FINISHED) this.nextEvents.length = 0;
      }
    }
    return !(this.status & STATUS_FINISHED);
  }

  /** Snapshot the machine: `{ status, event, stack }` (stack root→leaf). */
  dump(...args: unknown[]): FsmProcessDump {
    const states: FsmStateSync[] = [];
    for (let state = this.state; state; state = state.parent) states.unshift(state);
    const stack: FsmStateDump[] = [];
    for (const state of states) {
      const stateDump: FsmStateDump = { key: state.key, data: {} };
      state._runHandler("dump", state, stateDump.data, ...args);
      stack.push(stateDump);
    }
    return { status: this.status, event: this.event, stack };
  }

  /**
   * Rebuild the machine from a dump (from either engine): recreate each state
   * (firing `onStateCreate`) and replay its `restore` hooks. The current stack is
   * replaced as-is — call `shutdown()` first to run its `onExit` handlers.
   */
  restore(dump: FsmProcessDump, ...args: unknown[]): this {
    this.status = dump.status || 0;
    this.event = dump.event;
    this.nextEvents.length = 0;
    this.state = undefined;
    for (const stateDump of dump.stack) {
      const target = this.state
        ? getSubstateTarget(this.state, stateDump.key)
        : { parent: undefined, key: stateDump.key, descriptor: this.rootDescriptor };
      this.state = this._newState(target.parent, target.key, target.descriptor);
      this.state._runHandler("restore", this.state, stateDump.data, ...args);
    }
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
    if (this.status & STATUS_FINISHED) return false;
    const target = getNextStateTarget(
      this.status,
      this.state,
      this.event,
      this.config.key,
      this.rootDescriptor,
    );
    const nextState = target && this._newState(target.parent, target.key, target.descriptor);
    [this.state, this.status] = settleStep(this.status, this.state, nextState);
    return !(this.status & STATUS_FINISHED);
  }
}
