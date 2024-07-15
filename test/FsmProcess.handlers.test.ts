import { describe, it, expect } from "./deps.ts";
import {
  FsmProcess,
  FsmState,
  FsmStateConfig,
  type FsmStateKey,
  getPrinter,
  setProcessPrinter,
} from "../src/index.ts";
import statecharts from "./process.CofeeMachine.ts";

type FsmStateHandler = (state: FsmState) => void;

function initProcessHandler(
  process: FsmProcess,
  // StateName => handler
  handlers: Record<string, any> = {},
  // LayerName => handler
  adapters: Record<string, FsmStateHandler>
) {
  const KEY = "handlersConfig";
  // const toHandler = createHandlers({ adapters });
  process.setData(KEY, handlers);

  process.onStateCreate((state) => {
    const key = state.key;
    let config;
    for (let parent = state.parent; !config && parent; parent = parent.parent) {
      const configs = parent.getData<Record<string, any>>(KEY);
      config = configs?.[key];
    }
    if (!config) {
      const configs = process.getData<Record<string, any>>(KEY);
      config = configs?.[key];
    }
    if (config) {
      if (typeof config === "function") {
        (function (
          handleState: () =>
            | undefined
            | (() => unknown)
            | Promise<undefined | (() => unknown)>
        ) {
          let cleanup: undefined | (() => unknown | Promise<unknown>);
          state.onEnter(async () => {
            cleanup = await handleState();
          });
          state.onExit(async () => {
            if (cleanup) cleanup();
          });
        })(config);
      } else {
        for (const [layerName, stateLayerConfigs] of Object.entries(config)) {
          if (layerName === "handlers") {
            state.setData(KEY, stateLayerConfigs);
          } else {
            if (!Array.isArray(stateLayerConfigs)) continue;
            const adapter = adapters[layerName];
            if (!adapter) continue;
            adapter(state);
          }
        }
      }
    }
  });
}

type HandlerLayerName = string;
type HandlerLayer = Record<HandlerLayerName, {}>;
type ProcessConfig = {
  statecharts: FsmStateConfig;
};
function newFsmProcess(processConfig: ProcessConfig) {
  let process = new FsmProcess(processConfig.statecharts);
  initProcessHandler(process, processConfig, {});

  return process;
}

type LayerName = string;

export type DocLayer = {
  default: string;
  doc: string;
};

export type ServiceName = string;
export type FieldName = string;
export type DependenciesDeclaration = Record<FieldName, ServiceName>;
export type Dependencies = Record<FieldName, ResolvedService>;
export type Service<T = any> = (deps: Dependencies) => AsyncGenerator<T>;
export type ResolvedService<T = any> = () => AsyncGenerator<T>;
export type GuardFunction = (deps: Dependencies) => any[];
export type ServiceLayer<T = any> = {
  name: ServiceName;
  deps?: DependenciesDeclaration;
  guard?: GuardFunction;
} & (
  | {
      service: Service<T>;
    }
  | {
      // Module version
      default: Service<T>;
    }
);

export type Action = (
  deps: Dependencies
) => undefined | (() => unknown) | Promise<undefined | (() => unknown)>;
export type ActionLayer = {
  name: ServiceName;
  deps?: DependenciesDeclaration;
} & (
  | {
      action: Action;
    }
  | {
      // Module version
      default: Action;
    }
);

export type HandlersMap = {
  docs?: DocLayer[];
  services?: ServiceLayer[];
  actions?: ActionLayer[];
  // stores?: StoreLayer[];
  // triggers?: TriggerLayers[];
} & {
  handlers?: HandlersMap;
} & Record<string, any>;

export type StateHandlerDescription = Record<
  FsmStateKey,
  Record<LayerName, any[]>
>;

const processConfig = {
  statecharts,

  handlers: {
    CoffeeMachine: function () {
      console.log("CoffeeMachine: enter");
      return async () => {
        console.log("CoffeeMachine: exit");
      };
    },
    WaitForSelection: function () {
      console.log("WaitForSelection: enter");
      return async () => {
        console.log("WaitForSelection: exit");
      };
    },
  },
};

describe("FsmAsyncProcess: handlers", () => {
  it("should iterate over states and perform required state transitions", async () => {
    const testTraces: string[] = [];
    let process = newFsmProcess(processConfig);
    // setProcessPrinter(process, {
    //   lineNumbers: true,
    //   print: (...messages: string[]) => {
    //     testTraces.push(messages.join(""));
    //   },
    // });
    // initProcessHandler(process, {}, {});

    // async function handleState() {
    //   console.log("Entering");
    //   return () => {
    //     console.log("Exit");
    //   };
    // }

    // process.onStateCreate((state) => {
    //   const print = getPrinter(state);
    //   state.onEnter(() => {
    //     print(`<${state?.key} event="${state.process.event}">`);
    //   });
    //   s    // process.onStateCreate((state) => {
    //   const print = getPrinter(state);
    //   state.onEnter(() => {
    //     print(`<${state?.key} event="${state.process.event}">`);
    //   });
    //   state.onExit(() => {
    //     print(`</${state.key}>`);
    //   });
    // });tate.onExit(() => {
    //     print(`</${state.key}>`);
    //   });
    // });
    const events = [
      "",
      "touch",
      "select",
      // Check availability:
      "ok",
      // Head water:
      "done",
      // Brew drink:
      "done",
      // Pickup the drink:
      "taken",
    ];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      await process.dispatch(event);
    }
    console.log(testTraces);
  });
});
