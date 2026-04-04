import type { FsmStateConfig } from "../core/fsm-state-config.ts";

/** A handler invoked when a state is entered. */
export type StageHandler<C = Record<string, unknown>> = (
  context: C,
) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>
  | AsyncGenerator<string, void, unknown>
  | Generator<string, void, unknown>;

/** Maps a state key to a handler module key for auto-discovery. */
type PatternFn = (state: string) => string;

const DEFAULT_PATTERNS: PatternFn[] = [
  (state) => state,
  (state) => `${state}Controller`,
  (state) => `${state}View`,
  (state) => `${state}Trigger`,
];

export interface HandlerRegistry {
  register(processName: string, config: FsmStateConfig): () => void;
  registerHandlers(processName: string, ...modules: unknown[]): () => void;
  getConfig(processName: string): FsmStateConfig;
  getLoader<C>(
    processName: string,
    patterns?: PatternFn[],
  ): (state: string, event?: string) => StageHandler<C>[];
}

export function createHandlerRegistry(): HandlerRegistry {
  const configs: Record<string, FsmStateConfig> = {};
  const handlers: Record<string, unknown[]> = {};

  return {
    register(processName: string, config: FsmStateConfig): () => void {
      configs[processName] = config;
      return () => {
        delete configs[processName];
      };
    },

    registerHandlers(processName: string, ...modules: unknown[]): () => void {
      let list = handlers[processName];
      if (!list) {
        list = handlers[processName] = [];
      }
      list.push(modules);
      return () => {
        const l = handlers[processName];
        if (!l) return;
        const idx = l.indexOf(modules);
        if (idx !== -1) l.splice(idx, 1);
        if (l.length === 0) delete handlers[processName];
      };
    },

    getConfig(processName: string): FsmStateConfig {
      const config = configs[processName];
      if (!config) {
        throw new Error(`No config registered for process "${processName}"`);
      }
      return config;
    },

    getLoader<C>(
      processName: string,
      patterns?: PatternFn[],
    ): (state: string, event?: string) => StageHandler<C>[] {
      const config = this.getConfig(processName);
      const pats = patterns ?? DEFAULT_PATTERNS;
      return (stateKey: string) => {
        const modulesKeys: string[] = [];
        if (stateKey === config.key) {
          modulesKeys.push("default");
        }
        for (const pattern of pats) {
          modulesKeys.push(pattern(stateKey));
        }
        const keysSet = new Set(modulesKeys);
        const processHandlers = handlers[processName] ?? [];
        return toStageHandlers<C>(processHandlers, (key: string) =>
          keysSet.has(key),
        );
      };
    },
  };
}

export function toStageHandlers<C>(
  value: unknown,
  accept: (key: string, value: unknown) => boolean,
): StageHandler<C>[] {
  return visit(value);

  function visit(val: unknown): StageHandler<C>[] {
    if (!val) return [];
    if (typeof val === "function") return [val] as StageHandler<C>[];
    if (typeof val !== "object") return [];
    if (Array.isArray(val)) return val.flatMap(visit);
    const obj = val as Record<string, unknown>;
    return Object.entries(obj).flatMap(([key, value]) => {
      return accept(key, value) ? visit(value) : [];
    });
  }
}
