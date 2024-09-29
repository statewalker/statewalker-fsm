import type { FsmProcess } from "../FsmProcess.ts";
import type { FsmState } from "../FsmState.ts";
import { getPrinter, type Printer } from "./printer.ts";

export function setProcessTracer(process: FsmProcess, print?: Printer) {
  return process.onStateCreate((state) => {
    setStateTracer(state, print);
  });
}

export function setStateTracer(state: FsmState, print?: Printer) {
  state.onEnter(() => {
    const printLine = print || getPrinter(state);
    printLine(`<${state?.key} event="${state.process.event}">`);
  });
  state.onExit(() => {
    const printLine = print || getPrinter(state);
    printLine(`</${state.key}> <!-- event="${state.process.event}" -->`);
  });
}
