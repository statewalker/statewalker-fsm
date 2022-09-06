export default function buildStateDescriptor(config = {}) {
  const { key, transitions = [], states = {}, options, ...params } = config;
  const result = {
    key,
    transitions: {},
    states: {},
    options: Object.assign(options || {}, params)
  };
  for (const t of transitions) {
    let stateKey, eventKey, targetStateKey;
    if (Array.isArray(t)) {
      stateKey = t[0];
      eventKey = t[1];
      targetStateKey = t[2];
    } else {
      const { from, event, to } = t;
      stateKey = from;
      eventKey = event;
      targetStateKey = to;
    }
    const index = result.transitions[stateKey] = result.transitions[stateKey] || {};
    index[eventKey] = targetStateKey;
  }
  if (Array.isArray(states)) {
    for (const s of states) {
      result.states[s.key] = buildStateDescriptor(s);
    }
  } else if (states) {
    for (const key of Object.keys(states)) {
      result.states[key] = buildStateDescriptor(states[key]);
    }
  }
  return result;
}