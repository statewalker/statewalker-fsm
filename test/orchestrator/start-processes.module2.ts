import { addTraces } from "./start-processes.utils";

export const name = "process-2";

export default [
  (context: Record<string, unknown>) => {
    addTraces(context, "Module2-A:enter");
    return () => {
      addTraces(context, "Module2-A:exit");
    };
  },
  (context: Record<string, unknown>) => {
    addTraces(context, "Module2-B:enter");
    return () => {
      addTraces(context, "Module2-B:exit");
    };
  },
];
