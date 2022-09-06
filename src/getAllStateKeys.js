/**
 * This method returns a list of all states used in 
 * the specified state descriptor.
 * 
 * @param {object} descriptor compiled state descriptor
 * defining transitions between sub-states and sub-states
 * @returns a sorted list of all states 
 */
export default function getAllStateKeys(descriptor) {
  const index = {};
  const add = (key) => index[key] = (index[key] || 0) + 1;
  visit(descriptor);
  return Object.keys(index).sort();
  function visit(descriptor) {
    add(descriptor.key);
    for (const [from, destinations] of Object.entries(descriptor.transitions)) {
      add(from);
      for (const targetKey of Object.values(destinations)) {
        add(targetKey);
      }
    }
    for (const [stateKey, stateDescriptor] of Object.entries(descriptor.states)) {
      add(stateKey);
      visit(stateDescriptor);
    }
  }
}