import { isThenable } from "./core/fsm-base-class.ts";
import { FsmStep, type FsmSteps } from "./core/fsm-controller.ts";
import type { FsmProcessDump } from "./core/fsm-process.ts";
import type { FsmStateConfig } from "./core/fsm-state-config.ts";
import { isStateTransitionEnabled } from "./core/fsm-transitions.ts";
import { assertDumpRootKey, type FsmStateNode } from "./core/fsm-traversal.ts";

// ---------------------------------------------------------------------------
// The runner core, shared by `startProcess` (async) and `startProcessSync`.
//
// Both runners do the same wiring around their engine: bind the machine into
// the shared context (`KEY_*`), keep the state-key stack, guard dispatched
// events, install the handlers `load` returns on each state entry (cleanups
// and generators), terminate, and rebuild everything on restore. That wiring
// is written once here, as step programs (see `core/fsm-controller.ts`) that
// the runner drives with `runAsync` (awaiting `load`, the handlers and the
// engine) or `runSync`. A flavour supplies only what really differs: how to
// step a generator, and what to wait for.
//
// The event-timing rule, written once: an event a handler dispatches, or a
// generator yields, is checked by the guard where it lands (the engine's
// `eventFilter`, run as the event is taken off its queue) and is applied once
// the machine has settled from the transition in progress, in order.
// ---------------------------------------------------------------------------

// Context keys under which a runner binds the machine into the shared context
// object. Why via context (not closures): handlers reach the running machine
// uniformly — `(ctx[KEY_DISPATCH])(event)` — regardless of where they are defined.
/**
 * Context key: the guarded dispatch fn — `(event) => Promise<void>` from `startProcess`,
 * `(event) => void` from `startProcessSync`. Ignores events with no transition.
 */
export const KEY_DISPATCH = "fsm:dispatch";
/** Context key: shuts the machine down — `() => Promise<void>` (async runner) or `() => void` (sync). */
export const KEY_TERMINATE = "fsm:terminate";
/** Context key: the current state-key stack (root→leaf), refreshed on every transition. */
export const KEY_STATES = "fsm:states";
/** Context key: the last dispatched event. */
export const KEY_EVENT = "fsm:event";

/** A live state as the runner core sees it. */
export interface RunnerState extends FsmStateNode {
  key: string;
  parent?: RunnerState;
  onEnter(handler: () => unknown): unknown;
  onExit(handler: () => unknown): unknown;
  _handleError(error: unknown): unknown;
}

/** The engine as the runner core sees it: either `FsmProcess` or `FsmProcessSync`. */
export interface RunnerProcess<S extends RunnerState> {
  state?: S;
  event?: string;
  running: boolean;
  eventFilter?: (event: string) => boolean;
  onStateCreate(handler: (state: S) => void): unknown;
  dispatch(event: string): unknown;
  shutdown(event?: string): unknown;
  restore(dump: FsmProcessDump, ...args: unknown[]): unknown;
}

/** What one runner flavour supplies to the core. */
export interface RunnerFlavour<S extends RunnerState> {
  /** The engine's name, for error messages (`"FsmProcess"`, `"FsmProcessSync"`). */
  owner: string;
  /** Drive a step program: `runAsync` or `runSync`. */
  run<R>(steps: FsmSteps<R>): R | Promise<R>;
  /**
   * A handler result the core could not use directly: a pending promise (only
   * the sync runner sees one, since the async runner awaits) — report it.
   */
  rejectThenable(state: S, result: PromiseLike<unknown>, what: string): void;
  /** Start stepping a generator a stage handler returned for `state`. */
  startGenerator(state: S, generator: Iterator<string> | AsyncIterator<string>): void;
  /** Stop every generator still running (after the machine was unwound). */
  stopGenerators(): void;
  /** Wait until no dispatch is in progress, before a restore. */
  whenIdle(): unknown;
}

/** One function the runner calls on each state entry; see `StageHandler`. */
type AnyStageHandler<C> = (context: C) => unknown;

/** The runner core bound to one machine: the parts the handle and the flavour use. */
export interface RunnerCore {
  /** `true` once terminated (until a restore). */
  readonly terminated: boolean;
  /** Dispatch an event into the machine (guarded where it lands). */
  dispatch(event: string): unknown;
  /** Terminate: unwind the machine and stop the generators. */
  terminate(): unknown;
  /** Unwind the live machine, then rebuild it from `dump` without re-running `load`. */
  restore(dump: FsmProcessDump, args: unknown[]): unknown;
}

/**
 * Wire `process` as a runner: context binding, state-key stack, guard, handler
 * installation on entry, terminate and restore. Binds `KEY_DISPATCH` (to
 * `dispatch`, the flavour's public dispatch) and `KEY_TERMINATE`.
 */
export function createRunnerCore<C, S extends RunnerState>({
  context,
  config,
  process,
  load,
  flavour,
  dispatch,
}: {
  context: C;
  config: FsmStateConfig;
  process: RunnerProcess<S>;
  load: (state: string, event: string | undefined) => unknown;
  flavour: RunnerFlavour<S>;
  /** The dispatch bound under `KEY_DISPATCH` (the sync runner's also pumps generators). */
  dispatch: (event: string) => unknown;
}): RunnerCore {
  const ctx = context as Record<string, unknown>;
  const statesStack: string[] = [];
  let terminated = false;

  const syncContext = () => {
    ctx[KEY_STATES] = [...statesStack];
    ctx[KEY_EVENT] = process.event;
  };

  /** On entry: push the key, then install what `load` returns for the state. */
  function* enterSteps(state: S): FsmSteps<void> {
    statesStack.push(state.key);
    syncContext();
    const step = new FsmStep();
    const loaded = yield step.call(() => load(state.key, process.event));
    if (isThenable(loaded)) {
      flavour.rejectThenable(state, loaded, "async load");
      return;
    }
    const modules = (loaded ?? []) as AnyStageHandler<C>[] | AnyStageHandler<C>;
    for (const module of Array.isArray(modules) ? modules : [modules]) {
      const result = yield step.call(() => module?.(context));
      install(state, result);
    }
  }

  /** A stage handler's result: a cleanup, a generator, or nothing. */
  function install(state: S, result: unknown) {
    if (isThenable(result)) {
      flavour.rejectThenable(state, result, "async stage handler");
    } else if (isIterator(result)) {
      flavour.startGenerator(state, result);
    } else if (typeof result === "function") {
      state.onExit(result as () => unknown);
    }
  }

  process.onStateCreate((state: S) => {
    state.onEnter(() => flavour.run(enterSteps(state)));
    state.onExit(() => {
      statesStack.pop();
      syncContext();
    });
  });

  // The guard runs when the engine takes the event off its queue, so an event
  // dispatched while the machine is busy is checked against the state it lands in.
  process.eventFilter = (event) => !process.state || isStateTransitionEnabled(process, event);

  function guardedDispatch(event: string): unknown {
    if (event !== undefined) return process.dispatch(event);
  }

  // Bound under KEY_TERMINATE and called from handlers: must not wait for the
  // unwinding (that would wait for the calling handler itself).
  function* terminateSteps(): FsmSteps<void> {
    terminated = true;
    yield new FsmStep().call(() => process.shutdown());
    flavour.stopGenerators();
  }

  function* restoreSteps(dump: FsmProcessDump, args: unknown[]): FsmSteps<void> {
    const step = new FsmStep();
    // External API: let an in-flight dispatch settle first (not from a handler).
    yield step.call(() => flavour.whenIdle());
    // Reject a foreign dump before the live machine is unwound.
    assertDumpRootKey(flavour.owner, dump, config.key);
    // Unwind the live stack first: its cleanups run and its generators stop,
    // so nothing from the replaced states leaks into the restored machine.
    if (process.state) yield step.call(() => process.shutdown());
    flavour.stopGenerators();
    statesStack.length = 0;
    terminated = false;
    yield step.call(() => process.restore(dump, ...args));
    for (let state = process.state as RunnerState | undefined; state; state = state.parent) {
      statesStack.unshift(state.key);
    }
    syncContext();
  }

  const terminate = () => flavour.run(terminateSteps());
  ctx[KEY_DISPATCH] = dispatch;
  ctx[KEY_TERMINATE] = terminate;

  return {
    get terminated() {
      return terminated;
    },
    dispatch: guardedDispatch,
    terminate,
    restore: (dump, args) => flavour.run(restoreSteps(dump, args)),
  };
}

/** `true` for a (sync or async) generator / iterator: anything with a callable `next`. */
export function isIterator(value: unknown): value is Iterator<string> | AsyncIterator<string> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { next?: unknown }).next === "function"
  );
}
