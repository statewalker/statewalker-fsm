import type { FsmState, FsmStateHandler } from "../FsmState.ts";

export const KEY_HANDLERS = "handlers";

export function callStateHandlers(state: FsmState) {
  const key = state.key;
  for (
    let parent: FsmState | undefined = state.parent;
    parent;
    parent = parent?.parent
  ) {
    const handlers =
      parent.getData<Record<string, FsmStateHandler[]>>(KEY_HANDLERS)?.[key];
    handlers?.forEach((handler) => {
      handler(state);
    });
  }
}

export function addSubstateHandlers(
  state: FsmState,
  handlers: Record<string, FsmStateHandler>,
) {
  const oldIndex =
    state.getData<Record<string, FsmStateHandler[]>>(KEY_HANDLERS);
  const index = oldIndex ? { ...oldIndex } : {};
  for (const [key, handler] of Object.entries(handlers)) {
    let list = index[key];
    if (!list) {
      list = index[key] = [];
    }
    list.push(handler);
  }
  state.setData(KEY_HANDLERS, index);
}
