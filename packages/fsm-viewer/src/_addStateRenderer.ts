import type { FsmProcess, FsmState } from "@statewalker/fsm";

export function _addStateRenderer(
  process: FsmProcess,
  renderer: (
    stack: string[],
    event?: string,
  ) => void | (() => void) | Promise<void | (() => void)>,
) {
  async function callHandlerOnState(state?: FsmState) {
    if (!state) return;
    const stack: string[] = [];
    for (let s: FsmState | undefined = state; s; s = s.parent) {
      stack.unshift(s.key);
    }
    const event = state.process.event;
    let cleanup = await renderer(stack, event);
    state.onExit(async () => cleanup?.());
  }
  callHandlerOnState(process.state);
  const cleanup = process.onStateCreate((state: FsmState) => {
    state.onEnter(callHandlerOnState);
  });
  return cleanup;
}
