import type { LauncherConfig, ProcessDef } from "../orchestrator/launcher.ts";
import { launcher } from "../orchestrator/launcher.ts";

function resolveModulesPaths(baseUrl: string, ...refs: string[]): string[] {
  return refs.map((ref) => new URL(ref, baseUrl).pathname);
}

export async function startProcesses({
  onExit,
  modules,
  context,
}: {
  onExit?: () => Promise<void> | void;
  modules: unknown[];
  context?: LauncherConfig["context"];
}) {
  const processDefs: ProcessDef[] = [];
  for (const mod of modules) {
    const imported =
      typeof mod === "string" || mod instanceof URL
        ? await import(String(mod))
        : mod;
    if (imported && typeof imported === "object") {
      processDefs.push(imported as ProcessDef);
    }
  }

  if (onExit) {
    processDefs.push({
      name: "Exit",
      config: { key: "Exit" },
      handlers: [() => onExit],
    });
  }

  return await launcher({ processes: processDefs, context });
}

export async function startNodeProcesses(modules?: string[]): Promise<void> {
  try {
    if (!modules) {
      modules = process.argv.slice(2);
    }
    const terminate = await startProcesses({
      modules: resolveModulesPaths(`file://${process.cwd()}/`, ...modules),
      onExit: () => process.exit(0),
    });
    process.on("SIGINT", terminate);
    process.on("SIGTERM", terminate);
    process.stdin.resume();
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

export default startNodeProcesses;
