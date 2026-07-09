import type { FsmProcess } from "../core/fsm-process.ts";

/** A sink for trace output — anything shaped like `console.log`. */
export type Printer = (...args: unknown[]) => void;
/**
 * Tuning for a `Printer`.
 * - `prefix` — string prepended to every line (e.g. a process tag).
 * - `print` — the underlying sink (defaults to `console.log`).
 * - `lineNumbers` — prepend an incrementing `[n]` counter.
 */
export type PrinterConfig = {
  prefix?: string;
  print?: (...args: unknown[]) => void;
  lineNumbers?: boolean;
};

const printerStore = new WeakMap<object, Printer>();

/**
 * Build a `Printer` bound to `process` that indents each line by the current state
 * nesting depth (two spaces per level), so log output visually mirrors the state
 * tree — hierarchical indentation makes enter/exit traces readable at a glance.
 */
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

/**
 * Attach a printer to `process` (stored in a weak map so it is GC'd with the
 * process). Handlers/tracers then reach it via {@link getProcessPrinter} /
 * {@link getPrinter} rather than threading a logger through every call.
 */
export function setProcessPrinter(
  process: FsmProcess,
  config: PrinterConfig = {},
) {
  const printer = preparePrinter(process, config);
  printerStore.set(process, printer);
}

/** The printer attached to `process`, or `console.log` if none was set. */
export function getProcessPrinter(process: FsmProcess): Printer {
  return printerStore.get(process) || console.log;
}

/** The printer for a state — its own if set, else its process's (see {@link getProcessPrinter}). */
export function getPrinter(state: { process: FsmProcess }): Printer {
  return printerStore.get(state) || getProcessPrinter(state.process);
}
