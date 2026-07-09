import { bindMethods, FsmBaseClass } from "./fsm-base-class.ts";
import type { FsmProcess } from "./fsm-process.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

/** Serialized form of a single state: its `key` plus the `data` bag its `dump` hooks filled. */
export type FsmStateDump = Record<string, unknown> & {
  key: string;
  data: Record<string, unknown>;
};
/** An `onEnter` / `onExit` callback; receives the state it fired on. */
export type FsmStateHandler = (
  state: FsmState,
  ...args: unknown[]
) => void | Promise<void>;

/** A `dump` / `restore` callback; reads or fills the mutable per-state `data` bag. */
export type FsmStateDumpHandler = (
  state: FsmState,
  dump: FsmStateDump,
) => void | Promise<void>;

/** An `onStateError` callback; receives the error thrown by another handler on this state. */
export type FsmStateErrorHandler = (
  state: FsmState,
  error: unknown,
) => void | Promise<void>;

/**
 * One live node in a running machine's active-state stack.
 *
 * A state needs a place to attach behaviour and record data while it is active.
 * `FsmState` is that handle — created by the engine each time a state is entered,
 * discarded when it exits — so handlers can capture per-activation closures instead
 * of sharing mutable machine-wide state. It offers lifecycle hooks `onEnter` /
 * `onExit` / `onStateError`, serialization hooks `dump` / `restore`, and the tree
 * links `key` / `parent` / `descriptor`; every hook method returns a disposer.
 * Attach hooks from within `FsmProcess.onStateCreate((state) => …)`, or let
 * `startProcess` install them for you from a `load` callback.
 */
export class FsmState extends FsmBaseClass {
  process: FsmProcess;
  key: string;
  parent?: FsmState;
  descriptor?: FsmStateDescriptor;

  constructor(
    process: FsmProcess,
    parent: FsmState | undefined,
    key: string,
    descriptor?: FsmStateDescriptor,
  ) {
    super();
    this.process = process;
    this.key = key;
    this.parent = parent;
    this.descriptor = descriptor;
    bindMethods(this, "onEnter", "onExit", "dump", "restore", "onStateError");
  }

  /** Run when this state is entered. */
  onEnter(handler: FsmStateHandler) {
    return this._addHandler("onEnter", handler, true);
  }
  /** Run when this state exits — registered inner-first so unwinding is inner-to-outer. */
  onExit(handler: FsmStateHandler) {
    return this._addHandler("onExit", handler, false);
  }
  /** Handle an error thrown by another handler on this state (also bubbles to the process). */
  onStateError(handler: FsmStateErrorHandler) {
    return this._addHandler("onStateError", handler);
  }
  /** Contribute to this state's snapshot: fill `dump.data` when the process is dumped. */
  dump(handler: FsmStateDumpHandler) {
    return this._addHandler("dump", handler, true);
  }
  /** Rehydrate from this state's snapshot: read `dump.data` when the process is restored. */
  restore(handler: FsmStateDumpHandler) {
    return this._addHandler("restore", handler, true);
  }

  async _handleError(error: Error | unknown) {
    await this._runHandler("onStateError", this, error);
    await this.process._handleStateError(this, error);
  }
}
