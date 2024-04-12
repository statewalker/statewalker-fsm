import { FsmState } from "../../src/index.ts";
export type Printer = (...args: any[]) => void;

export const KEY_PRINTER = "printer";

export function setPrinter(
  state: FsmState,
  {
    prefix = "",
    print = console.log,
    lineNumbers = false,
  }: {
    prefix?: string;
    print?: (...args: any[]) => void;
    lineNumbers?: boolean;
  } = {}
) {
  const process = state.process;
  const shift = () => {
    let prefix = "";
    for (let s = process.state?.parent; !!s; s = s.parent) {
      prefix += "  ";
    }
    return prefix;
  };
  let lineCounter = 0;
  const getPrefix = lineNumbers ? () => `[${++lineCounter}]${shift()}` : shift;
  const printer = (...args: string[]) => print(prefix, getPrefix(), ...args);
  state.setData(KEY_PRINTER, printer);
}

export function getPrinter(state: FsmState): Printer {
  return state.getData(KEY_PRINTER, true) || console.log;
}
