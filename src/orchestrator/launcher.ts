import type { FsmStateConfig } from "../FsmStateConfig.ts";
import { ProcessConfigManager } from "./ProcessConfigManager.ts";
import { startFsmProcess } from "./startFsmProcess.ts";
import type { StageHandler } from "./types.ts";

export type ProcessConfig = {
  name: string;
  config?: FsmStateConfig;
  handlers?: (
    | StageHandler
    | {
        [state: string]: StageHandler | StageHandler[];
      }
  )[];
};
export type ProcessLauncherConfig = {
  start: string[];
  context?: Record<string, unknown>;
  processes: ProcessConfig[];
};

export type LauncherRootContext = Record<string, unknown> & {
  launch: (
    processName: string,
    context: Record<string, unknown>,
    startEvent?: string,
  ) => Promise<() => Promise<void>>;
};
export async function launcher(
  init: (
    root: LauncherRootContext,
  ) => ProcessLauncherConfig | Promise<ProcessLauncherConfig>,
) {
  const configsManager = new ProcessConfigManager();

  async function launch(
    processName: string,
    context: Record<string, unknown>,
    startEvent: string = "start",
  ) {
    const config = configsManager.getProcessConfig(processName);
    const load = configsManager.getHandlersLoader(processName);
    return startFsmProcess(context, config, load, startEvent);
  }

  const rootContext: LauncherRootContext = {
    launch,
  };
  const config = await init(rootContext);
  for (const process of config.processes) {
    if (process.config) {
      configsManager.registerConfig(process.name, process.config);
    }
    if (process.handlers) {
      configsManager.registerHandlers(process.name, ...process.handlers);
    }
  }

  const shutdowns: (() => Promise<void>)[] = [];
  for (const processName of config.start ?? []) {
    const parent = config.context ?? rootContext;
    const context = { parent };
    const shutdown = await launch(processName, context);
    shutdowns.push(shutdown);
  }

  return async () => {
    for (const shutdown of shutdowns) {
      await shutdown();
    }
  };
}
