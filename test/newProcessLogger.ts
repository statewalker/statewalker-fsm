import { FsmProcess } from "../src/index.ts";

export function newProcessLogger(
  process: FsmProcess,
  {
    prefix = "",
    print = console.log,
    lineNumbers = false,
  }: {
    prefix?: string;
    print?: (...args: string[]) => void;
    lineNumbers?: boolean;
  } = {}
): (...args: string[]) => void {
  const shift = () => {
    let prefix = "";
    for (let s = process.state?.parent; !!s; s = s.parent) {
      prefix += "  ";
    }
    return prefix;
  };
  let lineCounter = 0;
  const getPrefix = lineNumbers ? () => `[${++lineCounter}]${shift()}` : shift;
  return (...args: string[]) => print(prefix, getPrefix(), ...args);
}
