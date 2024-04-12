import { FsmProcess, FsmProcessHandler } from "./FsmProcess.ts";
import { FsmStateHandler } from "./FsmState.ts";

export function toProcessHandler<T>(
  stateHandlers: Record<string, FsmStateHandler>
): FsmProcessHandler {
  return (process: FsmProcess, ...args: unknown[]) => {
    const state = process.state;
    if (!state) return;
    const handler = stateHandlers[state.key];
    return handler?.(state, ...args);
  };
}

export function combindProcessHandlers(
  ...args: (FsmProcessHandler | Record<string, FsmStateHandler>)[]
) {}
