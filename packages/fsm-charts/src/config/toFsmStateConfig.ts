import type { FsmStateConfig, Transition } from "../types/index.js";
import { splitTransitionString } from "./splitTransitionString.js";

export function toFsmStateConfig(json: any): FsmStateConfig | undefined {
  if (!json || typeof json !== "object") return;
  const { key, transitions, states, ...options } = json;
  if (typeof key !== "string") return;
  const stateTransitions = toFsmTransitions(transitions);
  const substates = toArray(states)
    .map(toFsmStateConfig)
    .filter((v) => !!v) as FsmStateConfig[];
  const state: FsmStateConfig = {
    key,
    transitions: stateTransitions,
  };
  if (substates && substates.length > 0) state.states = substates;
  return Object.assign(state, options);

  function toFsmTransitions(json: any): Transition[] {
    const transitions: Transition[] = [];
    const index: Record<string, boolean> = {};
    const array = toArray(json);
    for (const line of array) {
      const lineTransitions =
        typeof line === "string"
          ? splitTransitionString(line)
          : [toArray(line)];
      for (const transition of lineTransitions.map(validateTransition)) {
        if (!transition) continue;
        const key = transition.join("|");
        if (key in index) continue;
        index[key] = true;
        transitions.push(transition);
      }
    }
    return transitions;
  }

  function validateTransition(value: any): Transition | undefined {
    const array = toArray(value);
    if (array.length !== 3) return;
    const [from, event, to] = array;
    if (
      typeof from !== "string" ||
      typeof event !== "string" ||
      typeof to !== "string"
    )
      return;
    return [from, event, to];
  }

  function toArray(value: any) {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }
}
