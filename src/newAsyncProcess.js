import { MODE, newAsyncTreeWalker } from "@statewalker/tree";
import newProcessInstance from "./newProcessInstance.js";

export default function newAsyncProcess({
  config,
  descriptor,
  before, after,
  newProcess,
  newState,
  handleError = console.error
}) {
  const [process, loadNextState] = newProcessInstance({
    config,
    descriptor,
    newProcess,
    newState
  });
  const shift = newAsyncTreeWalker(before, after, process);
  process.finished = false;
  process.next = (event) => {
    process.nextEvent = event;
    return process.running = process.running || Promise
      .resolve()
      .then(async () => {
        try {
          process.event = process.nextEvent;
          process.nextEvent = undefined;
          while (!process.finished && process.event) {
            process.finished = !await shift(loadNextState);
            if ((process.status & MODE.EXIT) && process.nextEvent) {
              // Consume the next event if it exists.
              process.event = process.nextEvent;
              process.nextEvent = undefined;
            } else if (process.status & MODE.LEAF) {
              // Returns control when the process is in a "leaf" state (a state without children)
              break;
            }
          }
        } catch (error) {
          handleError(error);
        }
      })
      .finally(() => process.running = undefined)
      .then(() => !process.finished);
  }
  return process;
}