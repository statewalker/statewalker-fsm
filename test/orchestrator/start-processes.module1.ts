import { addTraces } from "./start-processes.utils";

export const name = "process-1";

export default [
  (context: Record<string, unknown>) => {
    addTraces(context, "Module1:enter");
    return () => {
      addTraces(context, "Module1:exit");
    };
  },
];
