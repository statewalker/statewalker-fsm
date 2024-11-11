import { FsmProcess } from "../FsmProcess.ts";
import type { FsmStateConfig } from "../FsmStateConfig.ts";
import { setProcessPrinter } from "./printer.ts";
import { setProcessTracer } from "./tracer.ts";

export function newProcess(
  config: FsmStateConfig,
  {
    prefix,
    print,
    lineNumbers = true,
  }: {
    prefix?: string;
    print?: (...args: any[]) => void;
    lineNumbers?: boolean;
  },
): FsmProcess {
  let process = new FsmProcess(config);
  setProcessPrinter(process, {
    prefix,
    print,
    lineNumbers,
  });
  setProcessTracer(process);
  return process;
}
