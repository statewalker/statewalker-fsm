import type { FsmStateConfig } from "../core/fsm-state-config.ts";
import { ProcessConfigManager } from "./process-config-manager.ts";
import { startFsmProcess } from "./start-process.ts";
import type { StageHandler } from "./types.ts";

export type ProcessConfig = {
  name: string;
  config?: FsmStateConfig;
} & (
  | {
      handler?: StageHandler;
    }
  | {
      handlers?:
        | StageHandler
        | (
            | StageHandler
            | {
                [state: string]: StageHandler | StageHandler[];
              }
          )[];
    }
  | {
      default?:
        | StageHandler
        | (
            | StageHandler
            | {
                [state: string]: StageHandler | StageHandler[];
              }
          )[];
    }
);

function asArray<T>(
  value: T | T[] | undefined,
  filter: (v: T, idx: number) => T | undefined = (v) => v,
): T[] {
  if (value === undefined) return [];
  const array = Array.isArray(value) ? value : [value];
  return array.filter(Boolean).map(filter).filter(Boolean) as T[];
}

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
    process: Record<string, unknown>,
  ) {
    if (!process || typeof process !== "object") {
      throw new Error("Invalid process configuration: not an object");
    }
    const processName = process.name;
    if (!processName || typeof processName !== "string") {
      throw new Error("Invalid process configuration: missing or invalid name");
    }

    const processConfig = process.config as FsmStateConfig | undefined;
    if (processConfig && typeof processConfig !== "object") {
      throw new Error(
        `Invalid process configuration: config is not an object in process ${process.name}`,
      );
    }
    if (processConfig) {
      configsManager.registerConfig(processName, processConfig);
    }

    const processHandlers = asArray(
      process.handlers ?? process.handler ?? process.default,
      (v, idx) => {
        if (typeof v === "function") return v;
        if (typeof v === "object" && v !== null) return v;
        throw new Error(
          [
            `Invalid process configuration:`,
            `a process handler is not object nor function in process ${processName} at index ${idx}`,
            `Recieved: ${v === null ? "null" : typeof v}`,
          ].join("\n"),
        );
      },
    );
    if (processHandlers.length > 0) {
      configsManager.registerHandlers(processName, ...processHandlers);
    }
  }

  const rootContext = { "fsm:launch": launch };
  const init = typeof options === "function" ? options : async () => options;
  const config = await init(rootContext);
  if (typeof config !== "object" || !config) {
    throw new Error("Invalid launcher configuration");
  }

  const processes = asArray(
    config.processes ?? config.process ?? config.default,
    (v) => {
      if (typeof v === "function") {
        return {
          name: v.name || "",
          handler: v,
        };
      }
      if (typeof v !== "object") {
        throw new Error(
          "Invalid launcher configuration: process is not an object",
        );
      }
      return v;
    },
  );
  for (const process of processes) {
    registerProcess(configsManager, process);
  }

  const shutdowns: (() => Promise<void>)[] = [];
  let startProcesses = asArray<string>(config.start);
  if (startProcesses.length === 0) {
    startProcesses = processes.map((p) => p.name).filter(Boolean) as string[];
  }

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
