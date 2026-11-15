import { runAsync } from "./core/fsm-controller.ts";
import { FsmProcess, type FsmProcessDump } from "./core/fsm-process.ts";
import type { FsmState } from "./core/fsm-state.ts";
import type { FsmStateConfig } from "./core/fsm-state-config.ts";
import { createRunnerCore, type RunnerCore } from "./runner-core.ts";

export { KEY_DISPATCH, KEY_EVENT, KEY_STATES, KEY_TERMINATE } from "./runner-core.ts";

/**
 * Per-state behaviour contract used by `startProcess`. One function shape expresses
 * what to do while in a state, and its *return value* wires up the rest, so a state's
 * setup and teardown live together. The handler runs on entry with the shared
 * `context` and may return:
 * - nothing — no teardown;
 * - a cleanup `function` — registered as this state's `onExit`;
 * - an async/sync generator — run concurrently, each yielded string dispatched back
 *   into the machine (self-driving/reactive states), auto-`return()`ed on exit. A
 *   yielded event is applied once the machine has settled, in order. If the machine
 *   is idle, the next value is pulled after the event has been processed; while it is
 *   busy, the event is queued and the generator keeps being pulled.
 */
export type StageHandler<C = Record<string, unknown>> = (
  context: C,
) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>
  | AsyncGenerator<string, void, unknown>
  | Generator<string, void, unknown>;

/**
 * The caller's remote control returned by `startProcess`: dispatch events, stop the
 * machine and snapshot/rehydrate it without holding a reference to the underlying
 * `FsmProcess`. `restore` first unwinds the live stack (cleanups run, generators
 * stop); restored states do not re-run `load`. See `ProcessHandleSync` for the sync
 * runner's equivalent.
 */
export interface ProcessHandle {
  /** Dispatch an event (guarded — ignored unless it triggers a transition). */
  dispatch(event: string): Promise<void>;
  shutdown(): Promise<void>;
  dump(...args: unknown[]): Promise<FsmProcessDump>;
  restore(dump: FsmProcessDump, ...args: unknown[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// startProcess (also exported as startFsmProcess for backward compat)
// ---------------------------------------------------------------------------

/**
 * Ergonomic runner: build a machine, attach behaviour via one `load` callback, and
 * bind the machine into `context`.
 *
 * Doing this by hand (`new FsmProcess` + `onStateCreate` + `onEnter` + a loader +
 * context wiring) is boilerplate every consumer repeats, so `startProcess` does it
 * once — most callers use this instead of the raw engine. It creates the process; on
 * each state entry calls `load(stateKey, event)` and installs the returned
 * `StageHandler`s (their return values become `onExit` cleanups or event-yielding
 * generators — see `StageHandler`); binds `KEY_DISPATCH` / `KEY_TERMINATE` /
 * `KEY_STATES` / `KEY_EVENT` into `context`; dispatches `startEvent` to enter the
 * initial state; and returns a `ProcessHandle`.
 *
 * @param context shared object handlers read/write and the machine is bound into
 * @param config the declarative machine definition
 * @param load returns the handler(s) to run for a given `(stateKey, event)`
 * @param startEvent initial event (default `""`, the eventless start)
 */
export async function startProcess<C = unknown>(
  context: C,
  config: FsmStateConfig,
  load: (
    state: string,
    event: string | undefined,
  ) => StageHandler<C>[] | Promise<StageHandler<C>[]>,
  startEvent = "",
): Promise<ProcessHandle> {
  const process = new FsmProcess(config);
  // The context wiring, guard, handler installation, terminate and restore are
  // the shared runner core's; this runner supplies how to step an async
  // generator.
  const core: RunnerCore = createRunnerCore<C, FsmState>({
    context,
    config,
    process,
    load,
    dispatch,
    flavour: {
      owner: "FsmProcess",
      run: runAsync,
      rejectThenable: (state, result) => {
        // Never reached (this runner awaits every result); kept for the contract.
        result.then(undefined, (error) => state._handleError(error));
      },
      startGenerator: (state, generator) =>
        runGenerator(state, generator as AsyncGenerator<string, void, unknown>),
      stopGenerators: () => {
        // Each generator is `return()`ed by its state's onExit while unwinding.
      },
      whenIdle: () => process.whenIdle(),
    },
  });

  /**
   * Step a generator returned for `state`. Its events are applied only once the
   * machine has settled (the transition that created the state may still be
   * descending), in order — the core's rule. The generator itself is never held
   * at a `yield`: a handler may await something it does after yielding.
   */
  function runGenerator(state: FsmState, generator: AsyncGenerator<string, void, unknown>) {
    let stateExited = false;
    const stopped = () => stateExited || core.terminated;
    state.onExit(() => {
      stateExited = true;
      generator.return?.(undefined as never);
    });
    const pending: string[] = [];
    let draining: Promise<void> | undefined;
    const drain = () => {
      draining ??= (async () => {
        try {
          while (pending.length > 0 && !stopped()) {
            while (process.running) await process.whenIdle();
            if (stopped()) break;
            await dispatch(pending.shift() as string);
          }
        } finally {
          draining = undefined;
        }
      })();
      return draining;
    };
    (async () => {
      try {
        for await (const event of generator) {
          if (stopped()) break;
          pending.push(event);
          // Idle: process the event before pulling the next value. Busy
          // (e.g. still inside the entering transition): queue it and go on.
          if (process.running) void drain();
          else await drain();
          if (stopped()) break;
        }
      } catch (error) {
        // A generator `return()` during state exit / termination throws an
        // abort we intentionally swallow; a genuine error thrown by the
        // generator body must surface through the state's error handling
        // rather than vanish.
        if (!stopped()) await state._handleError(error);
      }
    })();
  }

  async function dispatch(event: string): Promise<void> {
    await core.dispatch(event);
  }

  // The handle's shutdown — external API: resolves once the stack is unwound,
  // even when a dispatch was in flight. Do not await it from a handler.
  async function shutdownHandle(): Promise<void> {
    await core.terminate();
    await process.whenIdle();
  }

  await process.dispatch(startEvent);
  return {
    dispatch,
    shutdown: shutdownHandle,
    dump: async (...args: unknown[]) => process.dump(...args),
    restore: async (dump: FsmProcessDump, ...args: unknown[]) => {
      await core.restore(dump, args);
    },
  };
}

/** Permanent equal alias of {@link startProcess} — the name existing consumers import. */
export const startFsmProcess = startProcess;
