import type { FsmProcess } from "../core/fsm-process.ts";
import type { FsmState } from "../core/fsm-state.ts";
import { getPrinter, type Printer } from "./printer.ts";

/**
 * Trace every state of `process`: as each state is created, attach a state tracer —
 * so you can watch the machine move as a readable stream of enter/exit markers
 * without editing any handler. Hooks `onStateCreate` and delegates to
 * {@link setStateTracer}; pass a `print` sink to override the process printer.
 */
export function setProcessTracer(process: FsmProcess, print?: Printer) {
  return process.onStateCreate((state: FsmState) => {
    setStateTracer(state, print);
  });
}

/**
 * Trace one state's lifecycle: emit `<key event="…">` on enter and `</key>` on exit
 * (XML-like, so nested states read as nested tags). Falls back to the state's
 * printer ({@link getPrinter}) when no `print` sink is given.
 */
export function setStateTracer(state: FsmState, print?: Printer) {
  state.onEnter(() => {
    const printLine = print || getPrinter(state);
    printLine(`<${state?.key} event="${state.process.event}">`);
  });
  state.onExit(async () => {
    await Promise.resolve().then(async () => {
      const printLine = print || getPrinter(state);
      printLine(`</${state.key}> <!-- event="${state.process.event}" -->`);
    });
  });
}
