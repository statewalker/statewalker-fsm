import type { FsmProcess } from "./fsm-process.ts";
import type { FsmState } from "./fsm-state.ts";
import { EVENT_ANY } from "./fsm-state-config.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

// ---------------------------------------------------------------------------
// Transition introspection — read-only queries over the state/transition graph
// ---------------------------------------------------------------------------

/**
 * List the transitions currently reachable from `state` — for a UI or viewer that
 * needs to know which events can fire right now (e.g. to render only the enabled
 * buttons). Collects `[from, event, to]` tuples by walking up the parent chain; the
 * nearest state's rule for an event wins, so an outer fallback is masked by an inner
 * override. The returned tuples are ordered outer→inner (root first).
 */
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
        // Mark the event seen regardless of target — an inner exit-to-final
        // (`to === ""`, a falsy target) must still mask an outer rule for the
        // same event, matching what `dispatch` actually resolves.
        index[event] = true;
        result.push([prevStateKey, event, target]);
      }
    }
  }
  return result;
}

/**
 * Guard: would `event` trigger any transition in the process's current state? Used
 * to avoid dispatching dead events — the runner calls it before `dispatch`, and
 * consumers use it to enable/disable controls. Returns `true` iff `event` appears
 * among `getStateTransitions(process.state)`.
 */
export function isStateTransitionEnabled(
  process: FsmProcess,
  event: string,
): boolean {
  const transitions = getStateTransitions(process.state);
  for (const [, ev] of transitions) {
    // A wildcard-event rule (`ev === EVENT_ANY`) matches any concrete event, just
    // as the engine's `getTargetStateKey` falls back to `(state, *)` / `(*, *)`.
    if (ev === event || ev === EVENT_ANY) return true;
  }
  return false;
}
