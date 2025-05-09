import { FsmProcess } from "./FsmProcess.js";
import type { FsmStateConfig } from "./FsmStateConfig.js";
import { isStateTransitionEnabled } from "./utils/transitions.js";

export function newFsmProcess(
  config: FsmStateConfig,
  handler: (
    state: string,
    event: undefined | string,
  ) =>
    | void
    | Promise<void>
    | ((event: undefined | string) => void | Promise<void>)
    | Promise<(event: undefined | string) => void | Promise<void>>,
): [
  dispatch: (event: string) => Promise<boolean>,
  shutdown: () => Promise<void>,
] {
  let started = false;
  let terminated = false;
  const process = new FsmProcess(config);
  process.onStateCreate((state) => {
    started = true;
    let cleanup: Awaited<ReturnType<typeof handler>> | undefined;
    state.onEnter(async () => {
      cleanup = await handler(state.key, process.event);
    });
    state.onExit(async () => {
      cleanup?.(process.event);
    });
  });
  async function dispatch(event: string): Promise<boolean> {
    return terminated ||
      (event !== undefined 
        // && (!started || isStateTransitionEnabled(process, event))
      )
      ? process.dispatch(event)
      : false;
  }
  async function shutdown(): Promise<void> {
    await process.shutdown();
    terminated = true;
  }
  return [dispatch, shutdown] as const;
}
