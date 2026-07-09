import type { FsmProcess } from "../core/fsm-process.ts";
export type Printer = (...args: unknown[]) => void;
export type PrinterConfig = {
  prefix?: string;
  print?: (...args: unknown[]) => void;
  lineNumbers?: boolean;
};

const printerStore = new WeakMap<object, Printer>();

export function preparePrinter(
  process: FsmProcess,
  { prefix = "", print = console.log, lineNumbers = false }: PrinterConfig,
): Printer {
  let lineCounter = 0;
  const shift = () => {
    let prefix = "";
    for (let s = process.state?.parent; s; s = s.parent) {
      prefix += "  ";
    }
    return prefix;
  };
  const getPrefix = lineNumbers ? () => `[${++lineCounter}]${shift()}` : shift;
  const printer = (...args: unknown[]) => print(prefix, getPrefix(), ...args);
  return printer;
}

export function setProcessPrinter(
  process: FsmProcess,
  config: PrinterConfig = {},
) {
  const printer = preparePrinter(process, config);
  printerStore.set(process, printer);
}

export function getProcessPrinter(process: FsmProcess): Printer {
  return printerStore.get(process) || console.log;
}

export function getPrinter(state: { process: FsmProcess }): Printer {
  return printerStore.get(state) || getProcessPrinter(state.process);
}
