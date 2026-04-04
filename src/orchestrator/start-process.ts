import { FsmProcess, type FsmProcessDump } from "../core/fsm-process.ts";
import type { FsmState } from "../core/fsm-state.ts";
import type { FsmStateConfig } from "../core/fsm-state-config.ts";
import type { FsmStateDescriptor } from "../core/fsm-state-descriptor.ts";
import type { StageHandler } from "./handler-registry.ts";

export interface ProcessHandle {
  shutdown(): Promise<void>;
  dump(...args: unknown[]): Promise<FsmProcessDump>;
  restore(dump: FsmProcessDump, ...args: unknown[]): Promise<void>;
}

// Context keys for binding FSM functions into the shared context object.
export const KEY_DISPATCH = "fsm:dispatch";
export const KEY_TERMINATE = "fsm:terminate";
export const KEY_STATES = "fsm:states";
export const KEY_EVENT = "fsm:event";

// ---------------------------------------------------------------------------
// Transition introspection
// ---------------------------------------------------------------------------

export function getStateTransitions(
  state?: FsmState,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const index: Record<string, boolean> = {};
  if (state) {
    let prevStateKey = state.key;
    for (let parent = state.parent; parent; parent = parent.parent) {
      if (!parent.descriptor) continue;
      result.push(
        ...getTransitionsFromDescriptor(parent.descriptor, prevStateKey, index),
      );
      prevStateKey = parent.key;
    }
  }
  return result.reverse();
}

function getTransitionsFromDescriptor(
  descriptor: FsmStateDescriptor,
  prevStateKey: string,
  index: Record<string, boolean>,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const prevStateKeys = [prevStateKey, "*"];
  for (const prevKey of prevStateKeys) {
    const targets = descriptor.transitions[prevKey];
    if (targets) {
      for (const [event, target] of Object.entries(targets)) {
        if (index[event]) continue;
        if (target) index[event] = true;
        result.push([prevStateKey, event, target]);
      }
    }
  }
  return result;
}

export function isStateTransitionEnabled(
  process: FsmProcess,
  event: string,
): boolean {
  const transitions = getStateTransitions(process.state);
  for (const [, ev] of transitions) {
    if (ev === event) return true;
  }
  return false;
}

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
            } catch {
              // Swallow generator errors after return()
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

/** @deprecated Use `startProcess` instead */
export const startFsmProcess = startProcess;
