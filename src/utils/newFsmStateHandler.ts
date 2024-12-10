import { FsmState } from "../FsmState";
import { isStateTransitionEnabled } from "./transitions";

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
  ) => Promise<undefined | FsmStateModule> = newModuleLoader(baseUrl),
): Promise<(state: FsmState) => Promise<FsmStateModule[]>> {
  return async (state: FsmState) => {
    const stack: string[] = [];
    for (let s: FsmState | undefined = state; s; s = s.parent) {
      stack.unshift(s.key);
    }

    const handlers: FsmStateModule[] = [];
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
export type FsmStateModule<
  FsmStateContext = Record<string, unknown>,
  FsmStateStore = Record<string, unknown>,
> = {
  context?:
    | ((...stack: FsmStateStore[]) => FsmStateContext)
    | (new (...stack: FsmStateStore[]) => FsmStateContext);
  // trigger?: (context: FsmStateContext) => AsyncGenerator<string>;
  trigger?: (
    context: FsmStateContext,
    onEvent: (event: string) => void,
  ) => void | (() => void);
  handler?: (
    context: FsmStateContext,
  ) => void | (() => void) | Promise<void | (() => void)>;
};


export function newModuleContext<
  C = Record<string, unknown>,
  S = Record<string, unknown>,
>(module: FsmStateModule<C, S>, ...stack: S[]): C {
  if (isClass<S[], C>(module.context)) {
    return new module.context(...stack) as unknown as C;
  } else if (isFunction<S[], C>(module.context)) {
    return module.context(...stack);
  } else {
    return stack[0] as unknown as C;
  }
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
  // console.log('============')
  // console.log('???', value, value?.prototype, value?.prototype?.constructor);
  return value?.prototype?.constructor?.toString().match(/^class/);
}

export function newStateHandlers<
  FsmStateContext = Record<string, unknown>,
  FsmStateStore = Record<string, unknown>,
>(
  loader: (
    state: FsmState,
  ) => Promise<FsmStateModule<FsmStateContext, FsmStateStore>[]>,
  newContext: (state: FsmState, ...stack: FsmStateStore[]) => FsmStateStore = (
    state,
  ) =>
    ({
      state: state.key,
      event: state.process.event,
    }) as unknown as FsmStateStore,
  contextCache: Map<unknown, FsmStateContext> = new Map<
    unknown,
    FsmStateContext
  >(),
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

    let registrations: (void | (() => void) | Promise<void | (() => void)>)[] =
      [];
    state.onExit(async () => {
      for (const r of registrations) {
        const registration = await r;
        registration?.();
      }
    });
    state.onEnter(async () => {
      const modules = await loader(state);
      if (!modules?.length) return;
      for (const module of modules) {
        const contextKey: unknown = module.context;
        // Create state context or get it from the local cache
        let stateContext = contextCache.get(contextKey);
        if (!stateContext) {
          stateContext = newModuleContext(module, ...stack);
          contextCache.set(contextKey, stateContext);
          registrations.push(() => {
            contextCache.delete(contextKey);
          });
        }

        // Initialize triggers
        if (module.trigger) {
          const process = state.process;
          // Set trigger
          let notify = async (event: string) => {
            if (event && isStateTransitionEnabled(process, event)) {
              process.dispatch(event);
            }
          };
          const cleanup = module.trigger(stateContext, notify);
          registrations.push(() => {
            notify = async () => {};
            cleanup?.();
          });
        }
        if (module.handler) {
          const cleanup = module.handler(stateContext);
          registrations.push(cleanup);
        }
      }
    });
  };
}
