import { FsmState } from "../FsmState";

export function newModuleLoader<T>(baseUrl: string) {
  const cache: Record<string, Promise<T>> = {};
  return async (path: string) => {
    return (cache[path] =
      cache[path] ||
      (async () => {
        const suffixes = ["/", "", ".js", "/index.js"];
        for (const suffix of suffixes) {
          const url = new URL(path + suffix, baseUrl).pathname;
          try {
            return (await import(url)) as T;
          } catch (error) {
            continue;
          }
        }
      })());
  };
}

export async function newHandlerLoader(
  baseUrl: string,
  loader: (
    path: string,
  ) => Promise<undefined | FsmStateHandler> = newModuleLoader(baseUrl),
): Promise<(state: FsmState) => Promise<FsmStateHandler[]>> {
  return async (state: FsmState) => {
    const stack: string[] = [];
    for (let s: FsmState | undefined = state; s; s = s.parent) {
      stack.unshift(s.key);
    }

    const handlers: FsmStateHandler[] = [];
    let topName: undefined | string;
    while (stack.length > 0) {
      const lastSegment = stack.pop();
      if (!topName) {
        topName = lastSegment;
        if (topName === undefined) break;
      }
      const path = [...stack, topName].join("/");
      const handler = await loader(path);
      handler && handlers.push(handler);
    }

    return handlers;
  };
}

/*
* StateContext: 
- Each context is a function or a class
- It recieves the stack of state objects
- The returned value is used to pass to the handler function
* Trigger function
- recieves the context instance
- notifies about changes using the given callback
* Handler
- recieves the context
- starts activities on call
- optionally returns a cleanup function
- could return a promise with optional cleanup function; the state is not 
  activated until all handlers return the control
*/
export type FsmStateHandler<
  FsmStateContext extends Record<string, unknown> = Record<string, unknown>,
  FsmStateStore = Record<string, unknown>,
> = {
  context?: (...stack: FsmStateStore[]) => FsmStateContext;
  trigger?: (
    context: FsmStateContext,
    listener: (event: string) => void,
  ) => void | (() => void);
  default?: (context: FsmStateContext) => void | (() => void);
  handler?: (context: FsmStateContext) => void | (() => void);
};

export function newStateHandlers<
  FsmStateContext extends Record<string, unknown> = Record<string, unknown>,
  FsmStateStore = Record<string, unknown>,
>(
  loader: (state: FsmState) => Promise<FsmStateHandler[]>,
  newContext: (state: FsmState, ...stack: FsmStateStore[]) => FsmStateStore = (
    state,
  ) =>
    ({
      state: state.key,
      event: state.process.event,
    }) as unknown as FsmStateStore,
) {
  return (state: FsmState) => {
    const stack: FsmStateStore[] = [];
    for (let s: FsmState | undefined = state.parent; !!s; s = s.parent) {
      const store = s.getData<FsmStateStore>("context");
      store && stack.push(store);
    }
    const store = newContext(state, ...stack);
    stack.unshift(store);
    state.setData("context", store);

    // const process = state.process;
    // let processContext = process.getData<FsmProcessContext>("context");
    // if (!processContext) {
    //   processContext = newContext(process);
    //   process.setData("context", processContext);
    // }
    let registrations: (void | (() => void))[] = [];
    state.onExit(() => {
      for (const registration of registrations) {
        registration?.();
      }
    });
    state.onEnter(async () => {
      const modules = await loader(state);
      if (!modules?.length) return;
      for (const module of modules) {
        // Update state context
        // TODO: use a stack of context objects
        const ctx = isClass(module.context)
          ? new module.context(...stack)
          : isFunction(module.context)
            ? module.context(...stack) || store
            : store;
        const stateContext = ctx as FsmStateContext;
        // Set trigger
        let notifyTrigger = (event: string) => {
          if (event) {
            // TODO: Check that the event is available in this state;
            state.process.dispatch(event);
          }
        };
        const removeTrigger = module?.trigger?.(stateContext, (event) =>
          notifyTrigger(event),
        );
        registrations.push(() => (notifyTrigger = () => {}));
        removeTrigger && registrations.push(removeTrigger);

        const handler = module.default || module.handler;
        registrations.push(handler?.(stateContext));
      }
      function isFunction<T extends Array<unknown>, R = unknown>(
        value: unknown,
      ): value is (...args: T) => R {
        return typeof value === "function";
      }
      function isClass<T extends Array<unknown>, R = unknown>(
        value: unknown,
      ): value is new (...args: T) => R {
        if (!isFunction(value)) return false;
        return value.prototype.constructor.toString().match(/^class/);
      }
    });
  };
}
