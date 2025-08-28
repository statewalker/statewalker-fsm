/**
 * Key used to bind the dispatch function to the process context.
 * The dispatch function allows triggering state transitions by dispatching events.
 *
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * // Initialize the FSM process using `startFsmProcess`
 * const dispatch = context["fsm:dispatch"] as (event: string) => Promise<void>;
 * await dispatch("someEvent");
 */
export const KEY_DISPATCH = "fsm:dispatch" as const;

/**
 * Key used to bind the terminate function to the process context.
 * The terminate function is used to gracefully shut down the FSM process.
 * It returns a Promise that resolves when the process has been fully terminated.
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * // Initialize the FSM process using `startFsmProcess`
 * const terminate = context["fsm:terminate"] as () => Promise<void>;
 * await terminate();
 * ```
 */
export const KEY_TERMINATE = "fsm:terminate" as const;

/**
 * Key used to bind the current stack of active states to the process context.
 * This provides a snapshot of the states the FSM process has entered.
 * It is represented as an array of strings -- state keys.
 *
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * // Initialize the FSM process using `startFsmProcess`
 * const states = context["fsm:states"] as string[];
 * console.log("Current active states:", states);
 * ```
 */
export const KEY_STATES = "fsm:states" as const;

/**
 * Key used to bind the current event being processed to the process context.
 * This represents the event that triggered the current state transition.
 * It is represented as a string.
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * // Initialize the FSM process using `startFsmProcess`
 * const event = context["fsm:event"] as string;
 * console.log("Current event:", event);
 * ```
 */
export const KEY_EVENT = "fsm:event" as const;

//-------------------------------------------------

// export const KEY_START_PROCESS = "fsm:sys:start" as const;
/**
 * Key used to register a new FSM process configuration in the process context.
 * This key is associated with a function that allows adding new FSM configurations.
 * The function takes a process name and its configuration, and returns a cleanup function
 * to remove the registered configuration.
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * initProcessManager(context); // Initialize the process manager in the context
 * ...
 * type StateConfig = { key: string; transitions?: string[][]; states?: StateConfig[] };
 * const registerConfig = context["fsm:sys:registerConfig"] as (name: string, config: StateConfig) => () => void;
 * const unregister = registerConfig("myProcess", { key: "Main", transitions: [...] });
 * // To unregister the configuration later
 * unregister();
 * ```
 */
export const KEY_REGISTER_CONFIG = "fsm:sys:registerConfig" as const;

/**
 * Key used to register state and event handlers for FSM processes in the process context.
 * This key is associated with a function that allows adding handler modules for a specific process.
 * The function takes a process name and a variable number of handler modules, returning a cleanup function
 * to remove the registered handlers.
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * initProcessManager(context); // Initialize the process manager in the context
 * ...
 * const registerHandlers = context["fsm:sys:registerHandlers"] as (name: string, ...modules: unknown[]) => () => void;
 * const handlerModule1 = {
 *   Main: async (context) => { ... },
 *   SomeState: async (context) => { ... },
 * }
 * // Views layer can be defined in the same or separate modules
 * const handlerModule3 = {
 *  MainView: async (context) => { ... },
 *  SomeStateView: async (context) => { ... },
 * }
 * // A common handler function to call for all states
 * const handlerModule2 = (context) => { ... };
 * const unregister = registerHandlers(
 *  "myProcess",
 *  handlerModule1,
 *  handlerModule2,
 *  handlerModule3
 * );
 * // To unregister the handlers later
 * unregister();
 * ```
 */
export const KEY_REGISTER_HANDLERS = "fsm:sys:registerHandlers" as const;

/**
 * Key used to launch an FSM process in the process context.
 * This key is associated with a function that initiates the FSM process based on its name and context.
 * The function takes the process name and context, returning either nothing, a cleanup function,
 * or a Promise that resolves to either nothing or a cleanup function.
 * Example usage:
 * ```typescript
 * const context: Record<string, unknown> = {};
 * initProcessManager(context); // Initialize the process manager in the context
 * // Register process configurations and handlers as needed
 *
 * const launchProcess = context["fsm:sys:launch"] as (name: string, context: Record<string, unknown>) => () => Promise<void>;
 * const terminate = await launchProcess("myProcess", context);
 * // To terminate the process later
 * terminate?.();
 * ```
 */
export const KEY_LAUNCH_PROCESS = "fsm:sys:launch" as const;
