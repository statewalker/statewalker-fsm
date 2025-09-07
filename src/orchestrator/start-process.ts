import { FsmProcess } from "../core/fsm-process.ts";
import type { FsmStateConfig } from "../core/fsm-state-config.ts";
import { isStateTransitionEnabled } from "../utils/index.ts";
import {
  KEY_DISPATCH,
  KEY_EVENT,
  KEY_STATES,
  KEY_TERMINATE,
} from "./constants.ts";
import { isGenerator } from "./is-generator.ts";
import type { StageHandler } from "./types.ts";

export async function startFsmProcess<C = unknown>(
  context: C,
  config: FsmStateConfig,
  load: (
    state: string,
    event: undefined | string,
  ) => StageHandler<C>[] | Promise<StageHandler<C>[]>,
  startEvent = "",
): Promise<() => Promise<void>> {
  let terminated = false;
  const ctx = context as Record<string, unknown>;
  const process = new FsmProcess(config);
  const statesStack: string[] = [];
  // ctx[KEY_PROCESS] = process;
  process.onStateCreate((state) => {
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
            result.return?.(void 0);
          });
          (async () => {
            for await (const event of result) {
              if (stateExited || terminated) {
                break;
              }
              await dispatch(event);
            }
          })();
        } else if (typeof result === "function") {
          state.onExit(result);
        }
      }
    });
    state.onExit(() => {
      statesStack.pop();
      ctx[KEY_STATES] = [...statesStack];
      ctx[KEY_EVENT] = process.event;
    });
  });
  async function terminate(): Promise<void> {
    terminated = true;
    await process.shutdown();
  }
  async function dispatch(event: string): Promise<void> {
    if (event !== undefined && isStateTransitionEnabled(process, event)) {
      await process.dispatch(event);
    }
  }
  ctx[KEY_DISPATCH] = dispatch;
  ctx[KEY_TERMINATE] = terminate;
  await process.dispatch(startEvent);
  return terminate;
}
