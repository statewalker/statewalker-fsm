import KEYS from "./KEYS.js";

/**
 * Returns all possible transitions from the current state of the process.
 * @param {Object} options - method parameters
 * @param {Process} options.process - the current process for which 
 * all transitions should be returned
 * @returns {Array<Object>} - an array of all transitions;
 * each entry in this returned array contains the following keys:
 * 1) parentStateKey - key of the state where the transition can be activated
 * 2) sourceStateKey - the initial transition state
 * 3) eventKey - key of the event activating transition
 * 4) targetStateKey - the resulting state for this transition
 * 
 */
export default function getAllTransitions(process) {
  const list = [];
  let stateKey = process.current ? process.current.key : KEYS.STATE_INITIAL;
  for (let i = process.stack.length - 1; i >= 0; i--) {
    const parentState = process.stack[i];
    const parentStateKey = parentState.key;
    const descriptor = parentState.descriptor;
    for (const sKey of [stateKey, KEYS.STATE_ANY]) {
      const stateTransitions = descriptor.transitions[sKey];
      if (!stateTransitions) continue;
      for (const[eventKey, targetKey] of Object.entries(stateTransitions)) {
        list.push([parentStateKey, sKey, eventKey, targetKey]);
      }
    }
    stateKey = parentStateKey;
  }
  return list;
}
