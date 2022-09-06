import { MODE } from "@statewalker/tree";
import buildStateDescriptor from "./buildStateDescriptor.js";
import getTargetStateKey from "./getTargetStateKey.js";
import getStateDescriptor from "./getStateDescriptor.js";
import KEYS from "./KEYS.js";

export default function newProcessInstance({
  config,
  descriptor,
  newState = (obj) => obj,
  newProcess = (descriptor) => ({
    descriptor,
    status: 0,
    stack: [],
    event: undefined,
    current: undefined
  })
}) {
  descriptor = descriptor || buildStateDescriptor(config);
  const process = newProcess(descriptor);
  const loadNextState = () => {
    let key, descriptor;
    if (!process.status) {
      descriptor = process.descriptor;
      key = descriptor.key;
    } else {
      if (!process.stack.length) {
        key = KEYS.STATE_FINAL;
      } else {
        const eventKey = process.event.key || KEYS.EVENT_EMPTY;
        const parentDescriptor = process.stack[process.stack.length - 1].descriptor;
        const stateKey = process.status & MODE.ENTER
          ? KEYS.STATE_INITIAL
          : process.current ? process.current.key : KEYS.STATE_FINAL;
        key = getTargetStateKey(parentDescriptor, stateKey, eventKey);
        if (key) {
          descriptor = getStateDescriptor(process, key);
        }
      }
    }
    return key ? newState({ process, key, descriptor }) : null;
  };
  return [process, loadNextState];
}
