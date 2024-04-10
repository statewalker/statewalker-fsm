import { FsmState } from "../../src/index.ts";
import { newProcessLogger } from "../newProcessLogger.ts";
import { addSubstateHandlers } from "./newStateHandlersContext.ts";
import { newStateValue } from "./newStateValue.ts";
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

export function ProductCatalog(state: FsmState) {
  const log = getPrinter(state);

  addSubstateHandlers(state, {
    ProductList: (state) => {
      state.onEnter(() => log("<ProductList>"));
      state.onExit(() => log("</ProductList>"));
    },
  });

  state.onEnter(async () => log("<ProductCatalog>"));
  state.onExit(() => log("</ProductCatalog>"));
}
