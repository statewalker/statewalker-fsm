import type { FsmStateConfig } from "../core/fsm-state-config.ts";
import type { StageHandler } from "./handler-registry.ts";
import { createHandlerRegistry } from "./handler-registry.ts";
import { startProcess } from "./start-process.ts";

export const KEY_LAUNCH_PROCESS = "fsm:launch";

export interface LauncherConfig {
  processes: ProcessDef[];
  start?: string[];
  context?: (parent: Record<string, unknown>) => Record<string, unknown>;
}

export interface ProcessDef {
  name: string;
  config: FsmStateConfig;
  handlers?: (StageHandler | Record<string, StageHandler | StageHandler[]>)[];
  start?: boolean;
}

export async function launcher(
  config: LauncherConfig,
): Promise<() => Promise<void>> {
  const registry = createHandlerRegistry();

  async function launch(
    processName: string,
    context: Record<string, unknown>,
    startEvent = "start",
  ) {
    const cfg = registry.getConfig(processName);
    const load = registry.getLoader(processName);
    return startProcess(context, cfg, load, startEvent);
  }

  const rootContext: Record<string, unknown> = {
    [KEY_LAUNCH_PROCESS]: launch,
  };
  const initContext = config.context ?? ((ctx: Record<string, unknown>) => ctx);

  const startSet = config.start ? new Set(config.start) : undefined;

  for (const def of config.processes) {
    registry.register(def.name, def.config);
    if (def.handlers?.length) {
      registry.registerHandlers(def.name, ...def.handlers);
    }
  }

  const shutdowns: (() => Promise<void>)[] = [];
  const seen = new Set<string>();
  for (const def of config.processes) {
    if (seen.has(def.name)) continue;
    seen.add(def.name);

    if (def.start === false) continue;
    if (startSet && !startSet.has(def.name)) continue;

    let context: Record<string, unknown> = {
      parent: rootContext,
      "fsm:name": def.name,
    };
    context = initContext(context) ?? context;
    const handle = await launch(def.name, context);
    shutdowns.push(handle.shutdown);
  }

  return async () => {
    for (const shutdown of shutdowns) {
      await shutdown();
    }
  };
}
