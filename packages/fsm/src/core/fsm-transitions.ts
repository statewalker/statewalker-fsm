import { EVENT_ANY, STATE_ANY } from "./fsm-state-config.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";
import type { FsmStateNode } from "./fsm-traversal.ts";

// ---------------------------------------------------------------------------
// Transition introspection — read-only queries over the state/transition graph
// ---------------------------------------------------------------------------

/**
 * List the transitions currently reachable from `state` — for a UI or viewer that
 * needs to know which events can fire right now (e.g. to render only the enabled
 * buttons). Collects `[from, event, to]` tuples by walking up the parent chain, the
 * way `dispatch` resolves an event: at each level the first matching rule wins
 * (`(state, event)` → `(*, event)` → `(state, *)` → `(*, *)`). A rule with a real
 * target masks the outer rules for its event, and a wildcard-event rule with a real
 * target masks every outer rule. An exit-to-final rule (`to === ""`) masks nothing:
 * the state exits and the event bubbles to the outer rules, so both are listed. `from`
 * is the key of the active state at that level, also for a `"*"` rule. The returned
 * tuples are ordered outer→inner (root first).
 */
export function getStateTransitions(
  state?: FsmStateNode,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const masked: Record<string, boolean> = {};
  if (state) {
    let prevStateKey = state.key;
    for (let parent = state.parent; parent; parent = parent.parent) {
      if (!parent.descriptor) continue;
      result.push(...getTransitionsFromDescriptor(parent.descriptor, prevStateKey, masked));
      // A wildcard-event rule with a real target catches every event at this level.
      if (masked[EVENT_ANY]) break;
      prevStateKey = parent.key;
    }
  }
  return result.reverse();
}

function getTransitionsFromDescriptor(
  descriptor: FsmStateDescriptor,
  prevStateKey: string,
  masked: Record<string, boolean>,
): [from: string, event: string, to: string][] {
  const result: [from: string, event: string, to: string][] = [];
  const seen = new Set<string>();
  for (const prevKey of [prevStateKey, STATE_ANY]) {
    const targets = descriptor.transitions[prevKey];
    if (!targets) continue;
    for (const [event, target] of Object.entries(targets)) {
      // `seen`: within one level the first matching rule wins (`(state, e)` before `(*, e)`).
      if (masked[event] || seen.has(event)) continue;
      seen.add(event);
      result.push([prevStateKey, event, target]);
      // An exit-to-final (falsy target) bubbles the event outward, so it masks nothing.
      if (target) masked[event] = true;
    }
  }
  return result;
}

/**
 * Guard: would `event` trigger any transition in the process's current state? Works
 * with both `FsmProcess` and `FsmProcessSync`. Used
 * to avoid dispatching dead events — the runner calls it before `dispatch`, and
 * consumers use it to enable/disable controls. Returns `true` iff `event`, or the
 * wildcard event `"*"`, appears among `getStateTransitions(process.state)`.
 */
export function isStateTransitionEnabled(
  process: { state?: FsmStateNode },
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
