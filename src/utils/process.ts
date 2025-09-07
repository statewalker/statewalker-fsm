import { FsmProcess } from "../core/fsm-process.ts";
import type { FsmStateConfig } from "../core/fsm-state-config.ts";
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
  const process = new FsmProcess(config);
  setProcessPrinter(process, {
    prefix,
    print,
    lineNumbers,
  });
  setProcessTracer(process);
  return process;
}
