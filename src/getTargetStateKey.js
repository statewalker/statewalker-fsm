import KEYS from "./KEYS.js";

export default function getTargetStateKey(descriptor, stateKey, eventKey) {
  const pairs = [
    [stateKey, eventKey],
    [KEYS.STATE_ANY, eventKey],
    [stateKey, KEYS.EVENT_ANY],
    [KEYS.STATE_ANY, KEYS.EVENT_ANY]
  ];
  let targetKey;
  for (let i = 0, len = pairs.length; (targetKey === undefined) && i < len; i++) {
    const [stateKey, eventKey] = pairs[i];
    const stateTransitions = descriptor.transitions[stateKey];
    if (!stateTransitions) continue;
    targetKey = stateTransitions[eventKey];
  }
  return (targetKey !== undefined) ? targetKey : KEYS.STATE_FINAL;
}