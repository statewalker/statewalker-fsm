import { FsmProcess } from "../FsmProcess.ts";
import type { FsmState } from "../FsmState.ts";
import type { FsmStateDescriptor } from "../FsmStateDescriptor.ts";

export function isStateTransitionEnabled(process: FsmProcess, event: string) {
  const transitions = getStateTransitions(process.state);
  let active = false;
  for (const [from, ev, to] of transitions) {
    if (ev === event) {
      active = true;
      break;
    }
  }
  return active;
}

export function getStateTransitions(
  state?: FsmState,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  let index = {};
  if (state) {
    let prevStateKey = state.key;
    for (let parent = state?.parent; parent; parent = parent.parent) {
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
  index: Record<string, boolean> = {},
) {
  const result: [from: string, event: string, to: string][] = [];
  const prevStateKeys = [prevStateKey, "*"];
  for (const prevKey of prevStateKeys) {
    const targets: undefined | Record<string, string> =
      descriptor.transitions[prevKey];
    if (targets) {
      for (const [event, target] of Object.entries(targets)) {
        if (index[event]) continue;
        if (target) {
          index[event] = true;
        }
        result.push([prevStateKey, event, target]);
      }
    }
  }
  return result;
}
