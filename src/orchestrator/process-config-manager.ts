import type { FsmStateConfig } from "../core/fsm-state-config.ts";
import { type StageHandler, toStageHandlers } from "./types.ts";

export interface IProcessConfigManager {
  getProcessConfig(processName: string): FsmStateConfig;
  getHandlersLoader<C = unknown>(
    processName: string,
  ): (state: string, event: undefined | string) => StageHandler<C>[];
  registerConfig(name: string, config: FsmStateConfig): () => void;
  registerHandlers(name: string, ...modules: unknown[]): () => void;
}

export class ProcessConfigManager implements IProcessConfigManager {
  protected configs: Record<string, FsmStateConfig> = {};
  protected handlers: Record<string, unknown[]> = {};

  getProcessConfig(processName: string): FsmStateConfig {
    return this.configs[processName] ?? { key: "Main" };
  }

  getHandlersLoader<C = unknown>(
    processName: string,
  ): (state: string, event: undefined | string) => StageHandler<C>[] {
    const config = this.getProcessConfig(processName);
    return (stateKey: string) => {
      const modulesKeys: string[] = [];
      if (stateKey === config.key) {
        modulesKeys.push("default");
      }
      modulesKeys.push(
        stateKey,
        `${stateKey}Controller`,
        `${stateKey}StateController`,
        `${stateKey}View`,
        `${stateKey}StateView`,
        `${stateKey}Trigger`,
        `${stateKey}StateTrigger`,
        `${stateKey}Test`,
        `${stateKey}StateTest`,
      );
      const keysSet = new Set(modulesKeys);
      const processHandlers = this.handlers[processName] ?? [];
      const handlers = toStageHandlers(processHandlers, (key: string) =>
        keysSet.has(key),
      );
      return handlers;
    };
  }

  registerConfig(name: string, config: FsmStateConfig): () => void {
    this.configs[name] = config;
    return () => {
      delete this.configs[name];
    };
  }

  registerHandlers(name: string, ...modules: unknown[]): () => void {
    let list: unknown[] = this.handlers[name];
    if (!list) {
      list = this.handlers[name] = [];
    }
    list.push(modules);
    return () => {
      list = list.filter((v) => v !== modules);
      if (list.length === 0) {
        delete this.handlers[name];
      }
    };
  }
}
