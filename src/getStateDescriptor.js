export default function getStateDescriptor(process, stateKey) {
  let descriptor;
  for (let i = process.stack.length - 1; !descriptor && i >= 0; i--) {
    const states = process.stack[i].descriptor.states || {};
    descriptor = states[stateKey];
  }
  return descriptor || { transitions: {}, states: {} };
}