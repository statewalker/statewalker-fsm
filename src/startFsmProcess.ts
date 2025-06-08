import { FsmProcess } from "./FsmProcess.js";
import type { FsmStateConfig } from "./FsmStateConfig.js";
import { isStateTransitionEnabled } from "./utils/transitions.js";

export type ModuleOrTrigger<C = unknown> = (
  context: C,
) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>
  | AsyncGenerator<string, void, unknown>
  | Generator<string, void, unknown>;

export function startFsmProcess<C>(
  context: C,
  config: FsmStateConfig,
  load: (
    state: string,
    event: undefined | string,
  ) =>
    | undefined
    | ModuleOrTrigger<C>
    | ModuleOrTrigger<C>[]
    | Promise<undefined | ModuleOrTrigger<C> | ModuleOrTrigger<C>[]>,
  startEvent = "",
): () => Promise<void> {
  let started = false;
  let terminated = false;
  const process = new FsmProcess(config);
  process.onStateCreate((state) => {
    started = true;
    state.onEnter(async () => {
      const ModuleOrTriggers = (await load(state.key, process.event)) ?? [];
      for (const ModuleOrTrigger of Array.isArray(ModuleOrTriggers) ? ModuleOrTriggers : [ModuleOrTriggers]) {
        const result = await ModuleOrTrigger?.(context);
        if (isGenerator(result)) {
          state.onExit(() => {
            result.return?.(void 0);
          });
          (async () => {
            for await (const event of result) {
              if (terminated) {
                break;
              }
              if (
                event !== undefined &&
                isStateTransitionEnabled(process, event)
              ) {
                await process.dispatch(event);
              }
            }
          })();
        } else if (typeof result === "function") {
          state.onExit(result);
        }
      }
    });
  });

  function isGenerator(
    value: unknown,
  ): value is
    | Generator<string, void, unknown>
    | AsyncGenerator<string, void, unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      "next" in value &&
      typeof (value as Generator<string, void, unknown>).next === "function"
    );
  }
  async function shutdown(): Promise<void> {
    await process.shutdown();
    terminated = true;
  } 
  process.dispatch(startEvent);
  return shutdown;
}
