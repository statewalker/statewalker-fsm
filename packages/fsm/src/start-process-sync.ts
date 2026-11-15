import { isThenable } from "./core/fsm-base-class.ts";
import { runSync } from "./core/fsm-controller.ts";
import type { FsmProcessDump } from "./core/fsm-process.ts";
import { FsmProcessSync } from "./core/fsm-process-sync.ts";
import type { FsmStateConfig } from "./core/fsm-state-config.ts";
import type { FsmStateSync } from "./core/fsm-state-sync.ts";
import { createRunnerCore, type RunnerCore } from "./runner-core.ts";

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

function asyncMisuse(what: string) {
  return new TypeError(
    `startProcessSync: ${what} used with the synchronous runner; it is not awaited. ` +
      "Use startProcess for async handlers.",
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
  let pumping = false;
  const process = new FsmProcessSync(config);
  const runners = new Set<GeneratorRunner>();
  // The context wiring, guard, handler installation, terminate and restore are
  // the shared runner core's; this runner supplies how to step a sync
  // generator: pull one value, and pump the pending values round-robin.
  const core: RunnerCore = createRunnerCore<C, FsmStateSync>({
    context,
    config,
    process,
    load,
    dispatch,
    flavour: {
      owner: "FsmProcessSync",
      run: runSync,
      rejectThenable: (state, result, what) => {
        // An async result cannot be honoured synchronously.
        result.then(undefined, (error) => state._handleError(error));
        state._handleError(asyncMisuse(what));
      },
      startGenerator: (state, generator) => {
        const runner: GeneratorRunner = {
          state,
          generator: generator as Generator<string, void, unknown>,
          closed: false,
        };
        runners.add(runner);
        state.onExit(() => close(runner));
        pull(runner);
      },
      stopGenerators: () => {
        for (const runner of [...runners]) close(runner);
      },
      whenIdle: () => undefined,
    },
  });

  /** Pull the next event of a generator into `pending` (or close it). */
  function pull(runner: GeneratorRunner) {
    try {
      const step = runner.generator.next();
      if (isThenable(step)) {
        // An async generator: its steps are promises and cannot be pumped here.
        runner.closed = true;
        runners.delete(runner);
        (step as PromiseLike<unknown>).then(undefined, (e) => runner.state._handleError(e));
        void (runner.generator as unknown as AsyncGenerator).return?.(undefined);
        runner.state._handleError(asyncMisuse("async generator"));
        return;
      }
      const { value, done } = step;
      if (runner.closed) {
        // The generator left its own state from its body: `close()` could not
        // `return()` it while it was running — finalize it now that it is suspended.
        if (!done) finalize(runner);
        return;
      }
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
    finalize(runner);
  }

  function finalize(runner: GeneratorRunner) {
    try {
      runner.generator.return?.(undefined);
    } catch (error) {
      // A generator that is executing right now (it dispatched an event that
      // exited its own state) cannot be returned; `pull` finalizes it once it
      // yields. Any other error comes from its `finally` block.
      if (!(error instanceof TypeError && /already running/i.test(error.message))) {
        runner.state._handleError(error);
      }
    }
  }

  /**
   * Feed pending generator events into the machine, round-robin, one event per
   * generator per pass, until no generator has anything left to say. Runs only
   * once the machine has settled (the core's event-timing rule).
   */
  function pump() {
    if (pumping || process.running) return;
    pumping = true;
    try {
      let progressed = true;
      while (progressed && !core.terminated) {
        progressed = false;
        for (const runner of [...runners]) {
          if (runner.closed || runner.pending === undefined || core.terminated) continue;
          const event = runner.pending;
          runner.pending = undefined;
          progressed = true;
          core.dispatch(event);
          if (!runner.closed) pull(runner);
        }
      }
    } finally {
      pumping = false;
    }
  }

  function dispatch(event: string): void {
    core.dispatch(event);
    pump();
  }

  process.dispatch(startEvent);
  pump();
  return {
    dispatch,
    shutdown: () => {
      core.terminate();
    },
    dump: (...args: unknown[]) => process.dump(...args),
    restore: (dump: FsmProcessDump, ...args: unknown[]) => {
      core.restore(dump, args);
    },
  };
}
