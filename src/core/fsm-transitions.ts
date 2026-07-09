import type { FsmProcess } from "./fsm-process.ts";
import type { FsmState } from "./fsm-state.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

// ---------------------------------------------------------------------------
// Transition introspection — read-only queries over the state/transition graph
// ---------------------------------------------------------------------------

export function getStateTransitions(
  state?: FsmState,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const index: Record<string, boolean> = {};
  if (state) {
    let prevStateKey = state.key;
    for (let parent = state.parent; parent; parent = parent.parent) {
      if (!parent.descriptor) continue;
      result.push(
        ...getTransitionsFromDescriptor(parent.descriptor, prevStateKey, index),
      );
      prevStateKey = parent.key;
    }
  }
  return result.reverse();
}

function getTransitionsFromDescriptor(
  descriptor: FsmStateDescriptor,
  prevStateKey: string,
  index: Record<string, boolean>,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const prevStateKeys = [prevStateKey, "*"];
  for (const prevKey of prevStateKeys) {
    const targets = descriptor.transitions[prevKey];
    if (targets) {
      for (const [event, target] of Object.entries(targets)) {
        if (index[event]) continue;
        if (target) index[event] = true;
        result.push([prevStateKey, event, target]);
      }
    }
  }
  return result;
}

export function isStateTransitionEnabled(
  process: FsmProcess,
  event: string,
): boolean {
  const transitions = getStateTransitions(process.state);
  for (const [, ev] of transitions) {
    if (ev === event) return true;
  }
  return false;
}
