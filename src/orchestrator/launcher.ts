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
// export type ProcessLauncherConfig = {
//   start: string[];
//   context?: Record<string, unknown>;
//   processes: ProcessConfig[];
// };

// export type LauncherRootContext = Record<string, unknown> & {
//   launch: (
//     processName: string,
//     context: Record<string, unknown>,
//     startEvent?: string,
//   ) => Promise<() => Promise<void>>;
// };

export async function launcher(options: unknown) {
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

  function registerProcess(
    configsManager: ProcessConfigManager,
    process: ProcessConfig,
  ) {
    if (!process || typeof process !== "object") {
      throw new Error("Invalid process configuration: not an object");
    }
    const processName = process.name;
    if (!processName || typeof processName !== "string") {
      throw new Error("Invalid process configuration: missing or invalid name");
    }

    const processConfig = process.config;
    if (processConfig && typeof processConfig !== "object") {
      throw new Error(
        `Invalid process configuration: config is not an object in process ${process.name}`,
      );
    }
    if (processConfig) {
      configsManager.registerConfig(process.name, processConfig);
    }
    let processHandlers = process.handlers;
    if (processHandlers) {
      if (typeof processHandlers !== "object") {
        throw new Error(
          `Invalid process configuration: handlers is not an array or object in process ${process.name}`,
        );
      }
      processHandlers = Array.isArray(processHandlers)
        ? processHandlers
        : [processHandlers];
      configsManager.registerHandlers(process.name, ...processHandlers);
    }
  }

  const rootContext = { "fsm:launch": launch };
  const init = typeof options === "function" ? options : async () => options;
  const config = await init(rootContext);
  if (typeof config !== "object" || !config) {
    throw new Error("Invalid launcher configuration");
  }
  let processes = config.processes ?? config.default;
  if (!processes || typeof processes !== "object") {
    throw new Error("Invalid launcher configuration: missing processes");
  }
  processes = Array.isArray(processes) ? processes : [];
  for (const process of processes) {
    registerProcess(configsManager, process);
  }

  const shutdowns: (() => Promise<void>)[] = [];
  const startProcesses = Array.isArray(config.start) ? config.start : [];
  let initContext: (
    parent: Record<string, unknown>,
  ) => Record<string, unknown> = (context) => context;

  const configContext = config.context ?? config.init;
  if (configContext) {
    if (typeof configContext === "function") {
      initContext = configContext;
    } else if (typeof configContext === "object") {
      initContext = () => ({ parent: configContext });
    } else {
      throw new Error("Invalid launcher configuration: context");
    }
  }
  for (const processName of startProcesses) {
    let context: Record<string, unknown> = {
      parent: rootContext,
      "fsm:name": processName,
    };
    context = initContext(context) ?? context;
    if (typeof context !== "object") {
      throw new Error(
        `Invalid launcher context for process "${processName}". Expected an object, but recieved ${typeof context}.`,
      );
    }
    const shutdown = await launch(processName, context);
    shutdowns.push(shutdown);
  }

  return async () => {
    for (const shutdown of shutdowns) {
      await shutdown();
    }
  };
}
