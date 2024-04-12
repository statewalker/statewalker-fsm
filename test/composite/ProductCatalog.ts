import { FsmState } from "../../src/index.ts";
import { newProcessLogger } from "../newProcessLogger.ts";
import { addSubstateHandlers } from "./context.handlers.ts";
import { getPrinter } from "./context.printer.ts";

// export type TPrinter = (...args: string[]) => void;
// const usePrinterValue = newStateValue<TPrinter>("printer");
// const usePrinter = (state: FsmState): TPrinter => {
//   let rootState = state;
//   while (rootState.parent) {
//     rootState = rootState.parent;
//   }
//   const [getPrinter, setPrinter] = usePrinterValue(rootState);
//   let printer = getPrinter();
//   if (!printer) {
//     printer = newProcessLogger(state.process);
//     setPrinter(printer);
//   }
//   return printer;
// };
export function ProductList(state: FsmState) {
  const log = getPrinter(state);
  state.onEnter(() => log("[ProductList]"));
  state.onExit(() => log("[/ProductList]"));
}

export function ProductCatalog(state: FsmState) {
  addSubstateHandlers(state, {
    ProductList,
  });

  const log = getPrinter(state);
  state.onEnter(async () => log("[ProductCatalog]"));
  state.onExit(() => log("[/ProductCatalog]"));
}
