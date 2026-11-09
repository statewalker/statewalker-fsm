import type { FsmAnyProcess, FsmState, FsmStateSync } from "@statewalker/fsm";

type Cleanup = void | (() => void);

/**
 * Call `renderer(stack, event)` for the process's current state and for every state
 * entered afterwards; a cleanup returned by the renderer runs when that state exits.
 * Returns a disposer that stops following newly created states.
 *
 * Works with both `FsmProcess` and `FsmProcessSync`: the handlers it registers are
 * synchronous. An async renderer (returning a promise) is supported on the async
 * engine only — `FsmProcess` awaits it before the state settles.
 */
export function _addStateRenderer(
  process: FsmAnyProcess,
  renderer: (stack: string[], event?: string) => Cleanup | Promise<Cleanup>,
) {
  function callHandlerOnState(state?: FsmState | FsmStateSync): void | Promise<void> {
    if (!state) return;
    const stack: string[] = [];
    for (let s: FsmState | FsmStateSync | undefined = state; s; s = s.parent) {
      stack.unshift(s.key);
    }
    const result = renderer(stack, state.process.event);
    if (result && typeof (result as Promise<Cleanup>).then === "function") {
      return (result as Promise<Cleanup>).then((cleanup) => {
        if (cleanup) state.onExit(() => cleanup());
      });
    }
    const cleanup = result as Cleanup;
    if (cleanup) state.onExit(() => cleanup());
  }
  callHandlerOnState(process.state);
  return process.onStateCreate((state: FsmState | FsmStateSync) => {
    state.onEnter(() => callHandlerOnState(state));
  });
}
