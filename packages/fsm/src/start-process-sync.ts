import type { FsmProcessDump } from "./core/fsm-process.ts";
import { FsmProcessSync } from "./core/fsm-process-sync.ts";
import type { FsmStateConfig } from "./core/fsm-state-config.ts";
import type { FsmStateSync } from "./core/fsm-state-sync.ts";
import { isStateTransitionEnabled } from "./core/fsm-transitions.ts";
import { KEY_DISPATCH, KEY_EVENT, KEY_STATES, KEY_TERMINATE } from "./start-process.ts";

/**
 * Synchronous per-state behaviour for `startProcessSync`. Runs on entry with the
 * shared `context` and may return:
 * - nothing — no teardown;
 * - a cleanup `function` — registered as this state's `onExit`;
 * - a (sync) generator — each yielded string is dispatched back into the machine.
 *   The generator starts on entry (code before the first `yield` runs then); each
 *   yielded event is dispatched once the machine has settled, and the next value is
 *   pulled after that event has been processed. It is `return()`ed when its state
 *   exits. A generator must eventually finish or leave its state — an endless one
 *   would keep `dispatch` from returning.
 */
export type StageHandlerSync<C = Record<string, unknown>> = (
  context: C,
) => void | (() => void) | Generator<string, void, unknown>;

/** The caller's remote control returned by `startProcessSync`. */
export interface ProcessHandleSync {
  /** Dispatch an event (guarded — ignored unless it triggers a transition). */
  dispatch(event: string): void;
  shutdown(): void;
  dump(...args: unknown[]): FsmProcessDump;
  restore(dump: FsmProcessDump, ...args: unknown[]): void;
}

type GeneratorRunner = {
  state: FsmStateSync;
  generator: Generator<string, void, unknown>;
  pending?: string;
  closed: boolean;
};

function isIterator(value: unknown): value is Generator<string, void, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { next?: unknown }).next === "function"
  );
}

/**
 * Synchronous twin of `startProcess`: build an `FsmProcessSync`, install the
 * handlers returned by `load(stateKey, event)` on each state entry, bind
 * `KEY_DISPATCH` / `KEY_TERMINATE` / `KEY_STATES` / `KEY_EVENT` into `context`,
 * enter the initial state, and return a `ProcessHandleSync`. Everything has
 * happened by the time a call returns — no promises anywhere.
 *
 * @param context shared object handlers read/write and the machine is bound into
 * @param config the declarative machine definition
 * @param load returns the handler(s) to run for a given `(stateKey, event)`
 * @param startEvent initial event (default `""`, the eventless start)
 */
export function startProcessSync<C = unknown>(
  context: C,
  config: FsmStateConfig,
  load: (state: string, event: string | undefined) => StageHandlerSync<C>[],
  startEvent = "",
): ProcessHandleSync {
  let terminated = false;
  let pumping = false;
  const ctx = context as Record<string, unknown>;
  const process = new FsmProcessSync(config);
  const statesStack: string[] = [];
  const runners = new Set<GeneratorRunner>();

  const syncContext = () => {
    ctx[KEY_STATES] = [...statesStack];
    ctx[KEY_EVENT] = process.event;
  };

  /** Pull the next event of a generator into `pending` (or close it). */
  function pull(runner: GeneratorRunner) {
    try {
      const { value, done } = runner.generator.next();
      if (done) close(runner);
      else runner.pending = value;
    } catch (error) {
      close(runner);
      runner.state._handleError(error);
    }
  }

  function close(runner: GeneratorRunner) {
    if (runner.closed) return;
    runner.closed = true;
    runner.pending = undefined;
    runners.delete(runner);
    try {
      runner.generator.return?.(undefined);
    } catch {
      // `return()` on a generator that is currently executing (it dispatched an
      // event that exited its own state) throws; it is finished either way.
    }
  }

  /**
   * Feed pending generator events into the machine, round-robin, one event per
   * generator per pass, until no generator has anything left to say.
   */
  function pump() {
    if (pumping || process.running) return;
    pumping = true;
    try {
      let progressed = true;
      while (progressed && !terminated) {
        progressed = false;
        for (const runner of [...runners]) {
          if (runner.closed || runner.pending === undefined || terminated) continue;
          const event = runner.pending;
          runner.pending = undefined;
          progressed = true;
          guardedDispatch(event);
          if (!runner.closed) pull(runner);
        }
      }
    } finally {
      pumping = false;
    }
  }

  process.onStateCreate((state) => {
    state.onEnter(() => {
      statesStack.push(state.key);
      syncContext();
      for (const module of load(state.key, process.event) ?? []) {
        const result = module?.(context);
        if (isIterator(result)) {
          const runner: GeneratorRunner = { state, generator: result, closed: false };
          runners.add(runner);
          state.onExit(() => close(runner));
          pull(runner);
        } else if (typeof result === "function") {
          state.onExit(result as () => void);
        }
      }
    });
    state.onExit(() => {
      statesStack.pop();
      syncContext();
    });
  });

  function guardedDispatch(event: string) {
    if (event !== undefined && isStateTransitionEnabled(process, event)) {
      process.dispatch(event);
    }
  }

  function dispatch(event: string): void {
    guardedDispatch(event);
    pump();
  }

  function terminate(): void {
    terminated = true;
    process.shutdown();
    for (const runner of [...runners]) close(runner);
  }

  function restore(dump: FsmProcessDump, ...args: unknown[]): void {
    // Unwind the live stack first: cleanups run and generators are closed.
    if (process.state) process.shutdown();
    for (const runner of [...runners]) close(runner);
    statesStack.length = 0;
    terminated = false;
    process.restore(dump, ...args);
    for (let state = process.state; state; state = state.parent) {
      statesStack.unshift(state.key);
    }
    syncContext();
  }

  ctx[KEY_DISPATCH] = dispatch;
  ctx[KEY_TERMINATE] = terminate;
  process.dispatch(startEvent);
  pump();
  return {
    dispatch,
    shutdown: terminate,
    dump: (...args: unknown[]) => process.dump(...args),
    restore,
  };
}
