import { FsmState, FsmStateHandler } from "../../src/index.ts";
import {
  findStateValue,
  getStateValue,
  setStateValue,
} from "./newStateValue.ts";

export const KEY_HANDLERS = "handlers";

export function callStateHandlers(state: FsmState) {
  const key = state.key;
  for (
    let parent: FsmState | undefined = state.parent;
    !!parent;
    parent = parent?.parent
  ) {
    const handlers = getStateValue<Record<string, FsmStateHandler[]>>(
      parent,
      KEY_HANDLERS
    )?.[key];
    handlers?.forEach((handler) => handler(state));
  }
}

export function addSubstateHandlers(
  state: FsmState,
  handlers: Record<string, FsmStateHandler>
) {
  const oldIndex = getStateValue<Record<string, FsmStateHandler[]>>(
    state,
    KEY_HANDLERS
  );
  const index = oldIndex ? { ...oldIndex } : {};
  for (const [key, handler] of Object.entries(handlers)) {
    const list = (index[key] = index[key] || []);
    list.push(handler);
  }
  setStateValue(state, KEY_HANDLERS, index);
}
