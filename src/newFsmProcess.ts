import { FsmProcess } from "./FsmProcess.js";
import type { FsmStateConfig } from "./FsmStateConfig.js";
import { isStateTransitionEnabled } from "./utils/transitions.js";

export type Module<C = unknown> = (
  context: C,
) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>;

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
  process.onStateCreate((state) => {
    started = true;
    state.onEnter(async () => {
      const modules = (await load(state.key, process.event)) ?? [];
      for (const module of Array.isArray(modules) ? modules : [modules]) {
        const handler = await module(context);
        if (typeof handler === "function") {
          state.onExit(handler);
        }
      }
    });
  });
  async function dispatch(event: string): Promise<boolean> {
    return terminated ||
      (event !== undefined &&
        (!started || isStateTransitionEnabled(process, event)))
      ? process.dispatch(event)
      : false;
  }
  async function shutdown(): Promise<void> {
    await process.shutdown();
    terminated = true;
  }
  return [dispatch, shutdown] as const;
}
