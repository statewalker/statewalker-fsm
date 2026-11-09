import type { FsmState } from "../core/fsm-state.ts";
import type { FsmStateSync } from "../core/fsm-state-sync.ts";
import { type FsmAnyProcess, getPrinter, type Printer } from "./printer.ts";

/**
 * Trace every state of `process` (async or sync): as each state is created, attach
 * a state tracer — so you can watch the machine move as a readable stream of
 * enter/exit markers without editing any handler. Hooks `onStateCreate` and
 * delegates to {@link setStateTracer}; pass a `print` sink to override the process
 * printer.
 */
export function setProcessTracer(process: FsmAnyProcess, print?: Printer) {
  return process.onStateCreate((state: FsmState | FsmStateSync) => {
    setStateTracer(state, print);
  });
}

/**
 * Trace one state's lifecycle: emit `<key event="…">` on enter and `</key>` on exit
 * (XML-like, so nested states read as nested tags). Falls back to the state's
 * printer ({@link getPrinter}) when no `print` sink is given. The handlers are
 * synchronous, so they work with both `FsmState` and `FsmStateSync`.
 */
export function setStateTracer(state: FsmState | FsmStateSync, print?: Printer) {
  state.onEnter(() => {
    const printLine = print || getPrinter(state);
    printLine(`<${state.key} event="${state.process.event}">`);
  });
  state.onExit(() => {
    const printLine = print || getPrinter(state);
    printLine(`</${state.key}> <!-- event="${state.process.event}" -->`);
  });
}
