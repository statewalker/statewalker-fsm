# @statewalker/fsm: Hierarchical Finite State Machine

Class-based HFSM with nested states, event-driven transitions, lifecycle hooks, and dump/restore serialization.

## Core Classes

### FsmStateConfig

Declarative state tree definition:

```typescript
const config: FsmStateConfig = {
  key: "Main",
  transitions: [
    ["", "start", "Active"],     // initial → Active
    ["Active", "done", ""],      // Active → final
    ["*", "reset", "Active"],    // any → Active
  ],
  states: [
    { key: "Active", states: [
      { key: "Step1" },
      { key: "Step2" },
    ], transitions: [
      ["", "", "Step1"],         // initial → Step1 (eventless)
      ["Step1", "next", "Step2"],
    ]},
  ],
};
```

### FsmProcess

Runtime state machine. Maintains a state stack (root → ... → leaf), dispatches events, manages lifecycle.

- `dispatch(event)` — trigger a transition
- `shutdown()` — exit all states gracefully
- `state` — current leaf state
- `status` — bitmask tracking enter/exit cycle
- `onStateCreate(handler)` — called for every new state (primary extension point)
- `dump()` / `restore(data)` — serialization hooks

### FsmState

Individual node in the state hierarchy.

- `key` — state name
- `parent` — parent state
- `onEnter(handler)` — run when entering
- `onExit(handler)` — run when exiting (reverse order)
- `onStateError(handler)` — error handling
- `dump()` / `restore(data)` — per-state serialization

## Orchestrator

### startProcess(context, config, load, startEvent?)

High-level entry point: creates FsmProcess, wires handlers, binds FSM into context.

Context keys bound:
- `fsm:dispatch` — dispatch function
- `fsm:terminate` — shutdown function
- `fsm:states` — current state stack
- `fsm:event` — last event

`load(stateKey)` returns handler(s) for each state. Handlers can return:
- `void` — no cleanup
- `Function` — registered as onExit cleanup
- `AsyncGenerator` — yielded events are dispatched to FSM

### HandlerRegistry

Convention-based handler discovery via `createHandlerRegistry()`:

```typescript
const registry = createHandlerRegistry();
registry.addConfig("MyProcess", config);
registry.addHandlers("MyProcess", { "Active": activeHandler, "Step1": step1Handler });
const load = registry.getLoader("MyProcess");
```

### launcher(config)

Multi-process launcher with strict types:

```typescript
interface LauncherConfig {
  processes: ProcessDef[];
  start?: string[];
  context?: (parent: Record<string, unknown>) => Record<string, unknown>;
}

interface ProcessDef {
  name: string;
  config: FsmStateConfig;
  handlers?: (StageHandler | Record<string, StageHandler | StageHandler[]>)[];
  start?: boolean;
}
```

## Utilities

- `printer(process)` — log state transitions to console
- `tracer(process)` — collect transition trace for testing

## Migration from pre-0.35

Removed in 0.35:
- `FsmBaseClass.data`, `.setData()`, `.getData()` — use closures or context instead
- `FsmState.getData(key, recursive)`, `.useData(key)` — use closures
- `FsmBaseClass._runHandlerParallel()` — handlers run sequentially now
- `newFsmProcess()` — use `startProcess()` from orchestrator
- `utils/handlers.ts` (`addSubstateHandlers`, `callStateHandlers`) — use HandlerRegistry
- `utils/process.ts` — use `startProcess()` directly
