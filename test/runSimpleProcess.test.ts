import { describe, it, expect } from "./deps.ts";
import { FsmProcess, FsmStateConfig } from "../src/index.ts";
import { setProcessTracer } from "../src/utils/tracer.ts";
import { setProcessPrinter } from "../src/utils/printer.ts";
import {
  FsmStateModule,
  newStateHandlers,
} from "../src/utils/newFsmStateHandler.ts";
// import { listenAsyncIterator, newSlot, Slot } from "./lib/newAsyncGenerator.ts";

function withContext<T>(
  key: string,
): (...stack: Record<string, unknown>[]) => [() => T, (value: T) => void] {
  return (...stack: Record<string, unknown>[]) => useContext<T>(key, ...stack);
}

function useContext<T>(
  key: string,
  ...stack: Record<string, unknown>[]
): [() => T, (value: T) => void] {
  function get(): T {
    for (const store of stack) {
      if (store[key]) return store[key] as T;
    }
    throw new Error(`Context "${key}" is not defined.`);
  }
  function set(value: T) {
    const [store] = stack;
    store[key] = value;
  }
  return [get, set];
}

const useEventsList = withContext<string[]>("eventsList");

// type EventHandler = (event: string, ...args: unknown[]) => void;
// function newEventManager() {
//   const index: {
//     [event: string]: EventHandler[];
//   } = {};
//   return {
//     on(event: string, handler: EventHandler) {
//       const list = (index[event] = index[event] || []);
//       list.push(handler);
//       return () => {
//         this.off(event, handler);
//       };
//     },
//     off(event: string, handler?: EventHandler) {
//       let list = index[event];
//       if (!list) return;
//       list = handler ? list.filter((h) => h !== handler) : [];
//       if (list.length) {
//         index[event] = list;
//       } else {
//         delete index[event];
//       }
//       return this;
//     },
//     notify(event: string, ...args: unknown[]) {
//       const list = index[event];
//       if (!list) return;
//       list.forEach((h) => h?.(event, ...args));
//       return this;
//     },
//   };
// }

type ContextListener = (context: MyContext) => void;
class MyContext {
  state: unknown;
  #events: string[];
  #listeners: ContextListener[] = [];

  onEvent(listener: ContextListener) {
    this.#listeners = [...this.#listeners, listener];
    return () => {
      this.#listeners = this.#listeners.filter((l) => listener !== l);
    };
  }
  notify() {
    this.#listeners.forEach((listener) => listener(this));
  }

  constructor(...stack: Record<string, unknown>[]) {
    this.state = stack[0].state;
    const [get] = useEventsList(...stack);
    this.#events = get();
  }

  getNextEvent() {
    return this.#events.shift();
  }
}

let notifyProcess: (event: string) => void = () => {};
const handlers: Record<
  string,
  {
    context: unknown;
    handler?: (context: any) => Promise<unknown>;
    trigger?: (context: any, notify: (event: string) => void) => unknown;
  }[]
> = {
  App: [
    {
      context: (...stack: Record<string, unknown>[]) => {
        const [_, setEvents] = useEventsList(...stack);
        setEvents(["no", "error", "retry", "no", "ok"]);
        return {
          state: "App",
          description: "AppContext",
        };
      },
      handler: async (context: { state: string; description: string }) => {
        console.log("App:", context.state);
        return async () => {
          console.log("App:", context.state);
        };
      },
    },
  ],
  default: [ 
    {
      context: class extends MyContext {},
      handler: async (context: MyContext) => {
        console.log(`* [${context.state}]`);
        // context.message = { type: "ENTER", state: context.state };
        context.notify();
        return async () => {
          // await Promise.resolve().then(() => {
          console.log(`* [/${context.state}]`);
          // context.message = { type: "EXIT", state: context.state };
          // });
        };
      },

      trigger: function (context: MyContext, notify: (event: string) => void) {
        return context.onEvent(() => {
          const event = context.getNextEvent();
          event && notify(event);
        });
      },
    },
  ],
};

describe("simple processing", () => {
  const config: FsmStateConfig = {
    key: "App",
    transitions: [
      ["", "*", "CheckExists"],
      ["CheckExists", "no", "Download"],
      ["CheckExists", "yes", "Process"],
      ["Download", "ok", "Process"],
      ["*", "error", "HandleError"],
      ["HandleError", "retry", "CheckExists"],
      ["HandleError", "*", ""],
    ],
  };

  function newPrintChecker() {
    const lines: unknown[][] = [];
    return [
      (...args: unknown[]) => {
        // console.log(args.join(""));
        lines.push(args);
      },
      (...control: unknown[][]) => {
        expect(lines.map((items) => items.join(""))).toEqual(control);
      },
    ];
  }

  const [addTraces, checkTraces] = newPrintChecker();

  async function run(...events: string[]) {
    const process = new FsmProcess(config);
    setProcessPrinter(process, {
      print: console.log, // addTraces,
      lineNumbers: false,
    });
    setProcessTracer(process);

    process.onStateCreate(
      newStateHandlers(async (state) => {
        return (handlers[state.key] || handlers.default) as FsmStateModule[];
      }),
    );
    notifyProcess = (event) => {
      process.dispatch(event);
    };
    for (const event of events) {
      await new Promise((r) => setTimeout(r, 1));
      notifyProcess(event);
      // await process.dispatch(event);
    }
  }

  it("should...", async () => {
    await run("");
    // await run("", "no", "error", "retry", "no", "ok");
    await new Promise((r) => setTimeout(r, 300));
  });
});
