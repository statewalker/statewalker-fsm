import { bindMethods, FsmBaseClass } from "./fsm-base-class.ts";
import {
  FsmState,
  type FsmStateDump,
  type FsmStateHandler,
} from "./fsm-state.ts";
import {
  EVENT_EMPTY,
  type FsmStateConfig,
  STATE_FINAL,
  STATE_INITIAL,
} from "./fsm-state-config.ts";
import { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

// Status bitmask: where the process is in the enter/exit cycle of `dispatch`.
// Why a bitmask (rather than an enum): the loop tests *phases* with cheap bitwise
// masks — `status & STATUS_ENTER`, `status & this.mask` — and composite masks
// (ENTER / EXIT) are just OR-combinations of the primitive bits.
/** Not started / no current transition. */
export const STATUS_NONE = 0;
/** Entering: descended into a parent's first (initial) child. */
export const STATUS_FIRST = 1;
/** Entering: advanced to a resolved target (sibling) state. */
export const STATUS_NEXT = 2;
/** Rested on a leaf — dispatch returns control here (the default `mask`). */
export const STATUS_LEAF = 4;
/** Exiting: popped back up to the parent state. */
export const STATUS_LAST = 8;
/** Terminated: the machine has exited its root and cannot advance further. */
export const STATUS_FINISHED = 16;

//
/** Composite: any "entering" phase. */
export const STATUS_ENTER = STATUS_FIRST | STATUS_NEXT;
/** Composite: any "exiting" phase. */
export const STATUS_EXIT = STATUS_LEAF | STATUS_LAST;

/** A process-level handler (`onStateCreate` / `onStateError`). */
export type FsmProcessHandler = (
  process: FsmProcess,
  ...args: unknown[]
) => void | Promise<void>;

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
 */
export class FsmProcess extends FsmBaseClass {
  state?: FsmState;
  event?: string;
  nextEvents: string[] = [];
  running: boolean = false;
  mask: number = STATUS_LEAF;
  status: number = 0;
  config: FsmStateConfig;
  rootDescriptor: FsmStateDescriptor;

  constructor(config: FsmStateConfig) {
    super();
    this.rootDescriptor = FsmStateDescriptor.build(config);
    this.config = config;
    bindMethods(this, "dispatch", "dump", "restore");
  }

  /** Force-exit the whole stack (root last), running each state's `onExit`; ends the machine. */
  async shutdown(event?: string) {
    while (this.state) {
      this.event = event;
      this.status = STATUS_FINISHED;
      await this.state?._runHandler("onExit", this.state);
      this.state = this.state.parent;
    }
  }

  /**
   * Feed an event to the machine and run the enter/exit cycle until it rests on a
   * leaf (`status & mask`) or finishes.
   *
   * If a dispatch is already running (e.g. an `onEnter` handler dispatches
   * synchronously), the event is appended to the `nextEvents` FIFO queue and applied
   * — in order, none dropped — when the current run settles; runs never nest. Returns
   * `false` once the machine has finished, `true` otherwise.
   */
  async dispatch(event: string): Promise<boolean> {
    // Queue the event. Re-entrant dispatches (from handlers running mid-settle)
    // append here and are drained in order — so no earlier event is overwritten.
    this.nextEvents.push(event);
    if (!this.running && !(this.status & STATUS_FINISHED)) {
      this.running = true;
      try {
        while (this.nextEvents.length > 0) {
          this.event = this.nextEvents.shift();
          while (true) {
            // ---
            if (this.status & STATUS_EXIT) {
              await this.state?._runHandler("onExit", this.state);
            }
            if (!(await this._update())) break;
            if (this.status & STATUS_ENTER) {
              await this.state?._runHandler("onEnter", this.state);
            }
            if (this.status & this.mask) break;
            // ---
          }
          if (this.status & STATUS_FINISHED) break;
        }
      } finally {
        this.running = false;
      }
    }
    return !(this.status & STATUS_FINISHED);
  }

  /**
   * Snapshot the machine to a plain object: `{ status, event, stack }` where the
   * stack is root→leaf, each entry carrying whatever its `dump` hooks recorded.
   */
  async dump(...args: unknown[]): Promise<FsmProcessDump> {
    const dumpState = async (state: FsmState) => {
      const stateDump: FsmStateDump = {
        key: state.key,
        data: {},
      };
      await state._runHandler("dump", state, stateDump.data, ...args);
      return stateDump;
    };
    const dumpStates = async (
      state: FsmState | undefined,
      stack: FsmStateDump[] = [],
    ) => {
      if (!state) return stack;
      state.parent && (await dumpStates(state.parent, stack));
      stack.push(await dumpState(state));
      return stack;
    };
    const dump: FsmProcessDump = {
      status: this.status,
      event: this.event,
      stack: await dumpStates(this.state),
    };
    return dump;
  }

  /**
   * Rebuild the machine from a `dump`: recreate each state in the stack (firing
   * `onStateCreate`) and replay its `restore` hooks, leaving the process resumable
   * from where it was snapshotted.
   */
  async restore(dump: FsmProcessDump, ...args: unknown[]) {
    this.status = dump.status || 0;
    this.event = dump.event;
    this.state = undefined;
    for (let i = 0; i < dump.stack.length; i++) {
      const stateDump = dump.stack[i];
      this.state = this.state
        ? await this._newSubstate(this.state, stateDump.key)
        : await this._newState(undefined, stateDump.key, this.rootDescriptor);
      await this.state._runHandler(
        "restore",
        this.state,
        stateDump.data,
        ...args,
      );
    }
    return this;
  }

  /** Primary extension point: fires once for every state the machine creates. */
  onStateCreate(handler: FsmStateHandler) {
    return this._addHandler("onStateCreate", handler, true);
  }

  onStateError(
    handler: (state: FsmState, error: unknown) => void | Promise<void>,
  ) {
    return this._addHandler("onStateError", handler);
  }

  async _handleStateError(state: FsmState, error: Error | unknown) {
    await this._runHandler("onStateError", state, error);
    this._handleError(error);
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

  async _getSubstate(
    parent: FsmState | undefined,
    prevStateKey: string | undefined,
  ) {
    if (!parent) return;
    const toState =
      parent.descriptor?.getTargetStateKey(
        prevStateKey || STATE_INITIAL,
        this.event || EVENT_EMPTY,
      ) || STATE_FINAL;
    if (!toState) return;
    return this._newSubstate(parent, toState);
  }

  async _newSubstate(parent: FsmState | undefined, toState: string) {
    let descriptor: FsmStateDescriptor | undefined;
    for (
      let state: FsmState | undefined = parent;
      !descriptor && state;
      state = state.parent
    ) {
      descriptor = state.descriptor?.states[toState];
    }
    return this._newState(parent, toState, descriptor);
  }

  /**
   * One step of the traversal: compute the next state and update `status`.
   *
   * Either descends to a child / advances to a resolved target (setting an ENTER
   * status), or — when no target resolves — settles on the current leaf
   * (`STATUS_LEAF`) or pops to the parent (`STATUS_LAST`), reaching `STATUS_FINISHED`
   * once the root is exited. Returns `false` when finished.
   */
  async _update() {
    if (this.status & STATUS_FINISHED) return false;
    const nextState =
      this.status !== STATUS_NONE
        ? this.status & STATUS_ENTER
          ? await this._getSubstate(this.state, STATE_INITIAL)
          : await this._getSubstate(this.state?.parent, this.state?.key)
        : await this._newState(undefined, this.config.key, this.rootDescriptor);
    if (nextState !== undefined) {
      this.state = nextState;
      this.status = this.status & STATUS_EXIT ? STATUS_NEXT : STATUS_FIRST;
    } else {
      if (this.status & STATUS_EXIT) {
        this.state = this.state?.parent;
        this.status = STATUS_LAST;
      } else {
        this.status = STATUS_LEAF;
      }
      if (!this.state) this.status = STATUS_FINISHED;
    }
    return !(this.status & STATUS_FINISHED);
  }
}
