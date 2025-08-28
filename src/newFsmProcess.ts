import { FsmProcess } from "./FsmProcess.ts";
import type { FsmStateConfig } from "./FsmStateConfig.ts";
import { isStateTransitionEnabled } from "./utils/transitions.ts";

export type Module<C = unknown> = (context: C) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>
  // Event emitters / triggers
  | Generator<string>
  | AsyncGenerator<string>;

export function newFsmProcess<C>(
  context: C,
  config: FsmStateConfig,
  load: (
    state: string,
    event: undefined | string,
  ) =>
    | undefined
    | Module<C>
    | Module<C>[]
    | Promise<undefined | Module<C> | Module<C>[]>,
): [
  dispatch: (event: string) => Promise<boolean>,
  shutdown: () => Promise<void>,
] {
  let started = false;
  let terminated = false;
  const process = new FsmProcess(config);
  async function dispatch(event: string): Promise<boolean> {
    return terminated ||
      (event !== undefined &&
        (!started || isStateTransitionEnabled(process, event)))
      ? process.dispatch(event)
      : false;
  }
  process.onStateCreate((state) => {
    started = true;
    state.onEnter(async () => {
      const modules = (await load(state.key, process.event)) ?? [];
      for (const module of Array.isArray(modules) ? modules : [modules]) {
        const result = await module?.(context);
        if (isGenerator(result)) {
          state.onExit(() => {
            result.return?.(void 0);
          });
          (async () => {
            for await (const event of result) {
              if (terminated) {
                break;
              }
              await dispatch(event);
              if (terminated) {
                break;
              }
            }
          })();
        } else if (typeof result === "function") {
          state.onExit(result);
        }
      }
    });
  });
  async function shutdown(): Promise<void> {
    await process.shutdown();
    terminated = true;
  }
  return [dispatch, shutdown] as const;

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
}
