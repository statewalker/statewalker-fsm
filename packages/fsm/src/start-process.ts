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
 *   into the machine (self-driving/reactive states), auto-`return()`ed on exit. A
 *   yielded event is applied once the machine has settled, and the next value is
 *   pulled after it has been processed (as with `startProcessSync`).
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

// Context keys under which `startProcess` binds the machine into the shared context
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

// ---------------------------------------------------------------------------
// Generator detection
// ---------------------------------------------------------------------------

function isGenerator(
  value: unknown,
): value is Generator<string, void, unknown> | AsyncGenerator<string, void, unknown> {
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
          // Events are applied only once the machine has settled (the transition
          // that created this state may still be descending), in order — the
          // same rule as `startProcessSync`. The generator itself is never held
          // at a `yield`: a handler may await something it does after yielding.
          const pending: string[] = [];
          let draining: Promise<void> | undefined;
          const drain = () => {
            draining ??= (async () => {
              try {
                while (pending.length > 0 && !stateExited && !terminated) {
                  while (process.running) await process.whenIdle();
                  if (stateExited || terminated) break;
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
              for await (const event of result) {
                if (stateExited || terminated) break;
                pending.push(event);
                // Idle: process the event before pulling the next value. Busy
                // (e.g. still inside the entering transition): queue it and go on.
                if (process.running) void drain();
                else await drain();
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
  // Bound under KEY_TERMINATE and called from handlers: must not wait for the
  // unwinding (that would wait for the calling handler itself).
  async function terminate(): Promise<void> {
    terminated = true;
    await process.shutdown();
  }

  // The handle's shutdown — external API: resolves once the stack is unwound,
  // even when a dispatch was in flight. Do not await it from a handler.
  async function shutdownHandle(): Promise<void> {
    await terminate();
    await process.whenIdle();
  }

  async function dumpProcess(...args: unknown[]): Promise<FsmProcessDump> {
    return process.dump(...args);
  }

  async function restoreProcess(dumpData: FsmProcessDump, ...args: unknown[]): Promise<void> {
    // Unwind the live stack first: its cleanups run and its generators stop,
    // so nothing from the replaced states leaks into the restored machine.
    // External API: let an in-flight dispatch settle first (do not await this
    // from a handler).
    await process.whenIdle();
    if (process.state) await process.shutdown();
    statesStack.length = 0;
    terminated = false;
    await process.restore(dumpData, ...args);
    for (let state: FsmState | undefined = process.state; state; state = state.parent) {
      statesStack.unshift(state.key);
    }
    ctx[KEY_STATES] = [...statesStack];
    ctx[KEY_EVENT] = process.event;
  }

  ctx[KEY_DISPATCH] = dispatch;
  ctx[KEY_TERMINATE] = terminate;
  await process.dispatch(startEvent);
  return {
    dispatch,
    shutdown: shutdownHandle,
    dump: dumpProcess,
    restore: restoreProcess,
  };
}

/** Permanent equal alias of {@link startProcess} — the name existing consumers import. */
export const startFsmProcess = startProcess;
