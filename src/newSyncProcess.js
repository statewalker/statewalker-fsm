import { MODE, newTreeWalker } from "@statewalker/tree";
import newProcessInstance from "./newProcessInstance.js";

export default function newSyncProcess({
  config,
  descriptor,
  before, after,
  newProcess,
  newState,
}) {
  const [process, loadNextState] = newProcessInstance({
    config,
    descriptor,
    newProcess,
    newState,
  });
  const shift = newTreeWalker(before, after, process);
  process.dispatch = process.next = (event) => {
    if (typeof event === 'string') event = { key : event };
    process.event = event;
    while (process.event) {
      if (!shift(loadNextState)) return false;
      if (process.status & MODE.LEAF) return true;
    }
  }
  return process;
}