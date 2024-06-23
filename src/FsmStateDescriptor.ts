import {
  type FsmStateConfig,
  EVENT_ANY,
  STATE_ANY,
  STATE_FINAL,
} from "./FsmStateConfig.ts";

export class FsmStateDescriptor {
  transitions: Record<string, Record<string, string>> = {};
  states: Record<string, FsmStateDescriptor> = {};

  static build(config: FsmStateConfig) {
    const descriptor = new FsmStateDescriptor();
    for (const [from, event, to] of config.transitions || []) {
      const index = (descriptor.transitions[from] =
        descriptor.transitions[from] || {});
      index[event] = to;
    }
    if (config.states) {
      for (const substateConfig of config.states) {
        descriptor.states[substateConfig.key] = this.build(substateConfig);
      }
    }
    return descriptor;
  }

  getTargetStateKey(stateKey: string, eventKey: string) {
    const pairs = [
      [stateKey, eventKey],
      [STATE_ANY, eventKey],
      [stateKey, EVENT_ANY],
      [STATE_ANY, EVENT_ANY],
    ];
    let targetKey;
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
