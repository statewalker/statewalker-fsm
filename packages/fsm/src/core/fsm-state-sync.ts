import { bindMethods, FsmBaseClassSync } from "./fsm-base-class.ts";
import type { FsmProcessSync } from "./fsm-process-sync.ts";
import type { FsmStateDump } from "./fsm-state.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

/** A synchronous `onEnter` / `onExit` callback; receives the state it fired on. */
export type FsmStateSyncHandler = (state: FsmStateSync, ...args: unknown[]) => void;

/** A synchronous `dump` / `restore` callback; reads or fills the per-state `data` bag. */
export type FsmStateSyncDumpHandler = (
  state: FsmStateSync,
  data: FsmStateDump["data"],
  ...args: unknown[]
) => void;

/** A synchronous `onStateError` callback. */
export type FsmStateSyncErrorHandler = (state: FsmStateSync, error: unknown) => void;

/**
 * Synchronous twin of `FsmState`: one live node in an `FsmProcessSync` stack.
 *
 * Same hooks, same ordering (`onExit` handlers run inner-first), same disposers —
 * but every handler is called synchronously. Returning a promise from a handler is
 * reported as a `TypeError` through `onStateError` (see `FsmBaseClassSync`).
 */
export class FsmStateSync extends FsmBaseClassSync {
  process: FsmProcessSync;
  key: string;
  parent?: FsmStateSync;
  descriptor?: FsmStateDescriptor;

  constructor(
    process: FsmProcessSync,
    parent: FsmStateSync | undefined,
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
  onEnter(handler: FsmStateSyncHandler) {
    return this._addHandler("onEnter", handler, true);
  }
  /** Run when this state exits — registered inner-first so unwinding is inner-to-outer. */
  onExit(handler: FsmStateSyncHandler) {
    return this._addHandler("onExit", handler, false);
  }
  /** Handle an error thrown by another handler on this state (also bubbles to the process). */
  onStateError(handler: FsmStateSyncErrorHandler) {
    return this._addHandler("onStateError", handler);
  }
  /** Contribute to this state's snapshot: fill `data` when the process is dumped. */
  dump(handler: FsmStateSyncDumpHandler) {
    return this._addHandler("dump", handler, true);
  }
  /** Rehydrate from this state's snapshot: read `data` when the process is restored. */
  restore(handler: FsmStateSyncDumpHandler) {
    return this._addHandler("restore", handler, true);
  }

  _handleError(error: Error | unknown): void {
    // Not via `_runHandler`: its catch re-routes here and would recurse forever.
    for (const handler of this.handlers.onStateError ?? []) {
      try {
        handler(this, error);
      } catch (e) {
        console.error(e);
      }
    }
    this.process._handleStateError(this, error);
  }
}
