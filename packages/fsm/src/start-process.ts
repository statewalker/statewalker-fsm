import { FsmProcess, type FsmProcessDump } from "./core/fsm-process.ts";
import type { FsmState } from "./core/fsm-state.ts";
import type { FsmStateConfig } from "./core/fsm-state-config.ts";
import { isStateTransitionEnabled } from "./core/fsm-transitions.ts";

/**
 * Per-state behaviour contract used by `startProcess`. One function shape expresses
 * what to do while in a state, and its *return value* wires up the rest, so a state's
 * setup and teardown live together. The handler runs on entry with the shared
 * `context` and may return:
 * - nothing — no teardown;
 * - a cleanup `function` — registered as this state's `onExit`;
 * - an async/sync generator — run concurrently, each yielded string dispatched back
 *   into the machine (self-driving/reactive states), auto-`return()`ed on exit.
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
 * The caller's remote control returned by `startProcess`: stop the machine and
 * snapshot/rehydrate it without holding a reference to the underlying `FsmProcess`.
 */
export interface ProcessHandle {
  shutdown(): Promise<void>;
  dump(...args: unknown[]): Promise<FsmProcessDump>;
  restore(dump: FsmProcessDump, ...args: unknown[]): Promise<void>;
}

// Context keys under which `startProcess` binds the machine into the shared context
// object. Why via context (not closures): handlers reach the running machine
// uniformly — `(ctx[KEY_DISPATCH])(event)` — regardless of where they are defined.
/** Context key: `(event) => Promise<void>` that dispatches an event (guarded). */
export const KEY_DISPATCH = "fsm:dispatch";
/** Context key: `() => Promise<void>` that shuts the machine down. */
export const KEY_TERMINATE = "fsm:terminate";
/** Context key: the current state-key stack (root→leaf), refreshed on every transition. */
export const KEY_STATES = "fsm:states";
/** Context key: the last dispatched event. */
export const KEY_EVENT = "fsm:event";

// ---------------------------------------------------------------------------
// Generator detection
// ---------------------------------------------------------------------------

function isGenerator(
  value: unknown,
): value is
  | Generator<string, void, unknown>
  | AsyncGenerator<string, void, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "next" in value &&
    typeof (value as { next: unknown }).next === "function"
  );
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
  let terminated = false;
  const ctx = context as Record<string, unknown>;
  const process = new FsmProcess(config);
  const statesStack: string[] = [];

  process.onStateCreate((state: FsmState) => {
    state.onEnter(async () => {
      statesStack.push(state.key);
      ctx[KEY_STATES] = [...statesStack];
      ctx[KEY_EVENT] = process.event;

      const modules = (await load(state.key, process.event)) ?? [];
      for (const module of Array.isArray(modules) ? modules : [modules]) {
        const result = await module?.(context);
        if (isGenerator(result)) {
          let stateExited = false;
          state.onExit(() => {
            stateExited = true;
            result.return?.(undefined as never);
          });
          (async () => {
            try {
              for await (const event of result) {
                if (stateExited || terminated) break;
                await dispatch(event);
                if (stateExited || terminated) break;
              }
            } catch (error) {
              // A generator `return()` during state exit / termination throws an
              // abort we intentionally swallow; a genuine error thrown by the
              // generator body must surface through the state's error handling
              // rather than vanish.
              if (!stateExited && !terminated) await state._handleError(error);
            }
          })();
        } else if (typeof result === "function") {
          state.onExit(result as () => void | Promise<void>);
        }
      }
    });
    state.onExit(() => {
      statesStack.pop();
      ctx[KEY_STATES] = [...statesStack];
      ctx[KEY_EVENT] = process.event;
    });
  });

  async function dispatch(event: string): Promise<void> {
    if (event !== undefined && isStateTransitionEnabled(process, event)) {
      await process.dispatch(event);
    }
  }
  async function terminate(): Promise<void> {
    terminated = true;
    await process.shutdown();
  }

  async function dumpProcess(...args: unknown[]): Promise<FsmProcessDump> {
    return process.dump(...args);
  }

  async function restoreProcess(
    dumpData: FsmProcessDump,
    ...args: unknown[]
  ): Promise<void> {
    statesStack.length = 0;
    terminated = false;
    await process.restore(dumpData, ...args);
    for (
      let state: FsmState | undefined = process.state;
      state;
      state = state.parent
    ) {
      statesStack.unshift(state.key);
    }
    ctx[KEY_STATES] = [...statesStack];
    ctx[KEY_EVENT] = process.event;
  }

  ctx[KEY_DISPATCH] = dispatch;
  ctx[KEY_TERMINATE] = terminate;
  await process.dispatch(startEvent);
  return {
    shutdown: terminate,
    dump: dumpProcess,
    restore: restoreProcess,
  };
}

/** Permanent equal alias of {@link startProcess} — the name existing consumers import. */
export const startFsmProcess = startProcess;
