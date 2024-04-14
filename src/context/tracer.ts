import { FsmProcess } from "../FsmProcess.ts";
import { FsmState } from "../FsmState.ts";
import { getPrinter, type Printer } from "./printer.ts";

export function setProcessTracer(process: FsmProcess, print?: Printer) {
  return process.onStateCreate((state) => {
    setStateTracer(state, print);
  });
}

export function setStateTracer(state: FsmState, print?: Printer) {
  const printLine = print || getPrinter(state);
  state.onEnter(() => {
    printLine(`<${state?.key} event="${state.process.event}">`);
  });
  state.onExit(() => {
    printLine(`</${state.key}> <!-- event="${state.process.event}" -->`);
  });
}
