import {
  EVENT_ANY,
  type FsmStateConfig,
  STATE_ANY,
  STATE_FINAL,
} from "./fsm-state-config.ts";

/**
 * The *compiled* form of an `FsmStateConfig` subtree.
 *
 * Resolving a transition happens on every event, so the flat `[from, event, to]`
 * tuple list is pre-indexed once into nested maps for O(1) lookup, and the
 * wildcard-fallback order is applied here rather than re-derived on each dispatch.
 * The shape is `transitions[from][event] = to` plus a `states` map of child
 * descriptors. `FsmProcess` builds one from your config in its constructor; you
 * rarely construct a descriptor directly.
 */
export class FsmStateDescriptor {
  transitions: Record<string, Record<string, string>> = {};
  states: Record<string, FsmStateDescriptor> = {};

  /**
   * Recursively compile a config (and its nested `states`) into descriptors,
   * turning the tuple list into the indexed `transitions` map.
   */
  static build(config: FsmStateConfig) {
    const descriptor = new FsmStateDescriptor();
    for (const [from, event, to] of config.transitions || []) {
      let index = descriptor.transitions[from];
      if (!index) {
        index = descriptor.transitions[from] = {};
      }
      index[event] = to;
    }
    if (config.states) {
      for (const substateConfig of config.states) {
        descriptor.states[substateConfig.key] =
          FsmStateDescriptor.build(substateConfig);
      }
    }
    return descriptor;
  }

  /**
   * Resolve the target state for a `(stateKey, eventKey)` pair. Tries the most
   * specific match first, then falls back through the wildcards —
   * `(state, event)` → `(*, event)` → `(state, *)` → `(*, *)` — and returns
   * `STATE_FINAL` if nothing matches, so an unmatched event exits the state rather
   * than silently doing nothing.
   */
  getTargetStateKey(stateKey: string, eventKey: string) {
    const pairs = [
      [stateKey, eventKey],
      [STATE_ANY, eventKey],
      [stateKey, EVENT_ANY],
      [STATE_ANY, EVENT_ANY],
    ];
    let targetKey: string | undefined;
    for (
      let i = 0, len = pairs.length;
      targetKey === undefined && i < len;
      i++
    ) {
      const [stateKey, eventKey] = pairs[i];
      const stateTransitions = this.transitions[stateKey];
      if (!stateTransitions) continue;
      targetKey = stateTransitions[eventKey];
    }
    return targetKey !== undefined ? targetKey : STATE_FINAL;
  }
}
