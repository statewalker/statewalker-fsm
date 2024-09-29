import { type FsmProcess } from "../FsmProcess.ts";
import { type FsmState } from "../FsmState.ts";
export type Printer = (...args: any[]) => void;
export type PrinterConfig = {
  prefix?: string;
  print?: (...args: any[]) => void;
  lineNumbers?: boolean;
};

export const KEY_PRINTER = "printer";

export function preparePrinter(
  process: FsmProcess,
  { prefix = "", print = console.log, lineNumbers = false }: PrinterConfig
): Printer {
  let lineCounter = 0;
  const shift = () => {
    let prefix = "";
    for (let s = process.state?.parent; !!s; s = s.parent) {
      prefix += "  ";
    }
    return prefix;
  };
  const getPrefix = lineNumbers ? () => `[${++lineCounter}]${shift()}` : shift;
  const printer = (...args: string[]) => print(prefix, getPrefix(), ...args);
  return printer;
}

export function setPrinter(state: FsmState, config: PrinterConfig = {}) {
  const printer = preparePrinter(state.process, config);
  state.setData(KEY_PRINTER, printer);
}

export function setProcessPrinter(
  process: FsmProcess,
  config: PrinterConfig = {}
) {
  const printer = preparePrinter(process, config);
  process.setData(KEY_PRINTER, printer);
}

export function getProcessPrinter(process: FsmProcess): Printer {
  return process.getData(KEY_PRINTER) || console.log;
}

export function getPrinter(state: FsmState): Printer {
  return state.getData(KEY_PRINTER, true) || getProcessPrinter(state.process);
}
