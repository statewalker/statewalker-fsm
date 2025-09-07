import { launcher } from "./launcher.ts";

export async function startProcesses({
  onExit,
  modules,
  init,
}: {
  onExit?: () => Promise<void> | void;
  modules: unknown[];
  init?: (
    context: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}) {
  const modulesList: unknown[] = [];
  for (const module of modules) {
    modulesList.push(
      typeof module === "string" || module instanceof URL
        ? await import(String(module))
        : module,
    );
  }
  return await launcher({
    init,
    processes: [
      ...modulesList,
      // This function is called on exit at the end of the process chain
      function Exit() {
        return onExit;
      },
    ],
  });
}
