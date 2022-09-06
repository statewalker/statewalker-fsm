import KEYS from "./KEYS.js";

export default function checkProcessDescriptor(descriptor) {
  return checkStateDescriptor(descriptor);

  function checkStateDescriptor(descriptor, report = [], stack = []) {
    stack = [...stack, descriptor.key];
    const result = Object.assign({ key: descriptor.key }, checkStateTransitions(descriptor));
    if (result.deadendStates.length || result.unreachableStates.length) {
      const info = { path: stack };
      report.push(info);
      if (result.deadendStates.length) info.deadendStates = result.deadendStates;
      if (result.unreachableStates.length) info.unreachableStates = result.unreachableStates;
    }
    for (const subDescriptor of Object.values(descriptor.states)) {
      checkStateDescriptor(subDescriptor, report, stack);
    }
    return report;
  }

  function checkStateTransitions(descriptor) {
    const sourceStates = {};
    const targetStates = {};
    for (const [from, destinations] of Object.entries(descriptor.transitions)) {
      sourceStates[from] = (sourceStates[from] || 0) + 1;
      for (const targetKey of Object.values(destinations)) {
        targetStates[targetKey] = (targetStates[targetKey] || 0) + 1;
      }
    }
    // Unreachable states - no transitions leading to these states
    const unreachableStates = [];
    // Deadend states - no transitions from these states
    const deadendStates = [];

    // Unreachable states - no transitions leading to these states
    for (const sourceKey of Object.keys(sourceStates)) {
      if (sourceKey !== KEYS.STATE_ANY &&
        sourceKey !== KEYS.STATE_FINAL &&
        sourceKey !== KEYS.STATE_INITIAL &&
        !(sourceKey in targetStates)) {
        unreachableStates.push(sourceKey);
      }
    }

    // Deadend states - no transitions from these states
    for (const targetKey of Object.keys(targetStates)) {
      if (targetKey !== KEYS.STATE_FINAL && !(targetKey in sourceStates)) {
        deadendStates.push(targetKey);
      }
    }

    return { unreachableStates, deadendStates }
  }
}