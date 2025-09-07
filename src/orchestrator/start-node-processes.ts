import { resolveModulesPaths } from "./resolve-module-refs.ts";
import { startProcesses } from "./start-processes.ts";
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
