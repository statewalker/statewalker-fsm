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

## Runner

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

`startFsmProcess` is an equal alias of `startProcess`; both names are exported.

## Utilities

Debug/observability helpers for attaching a printer or tracer to a process:

- `setProcessPrinter(process, config?)` — attach a printer that logs state transitions; `PrinterConfig` tunes the output
- `getProcessPrinter(process)` / `getPrinter(state)` — retrieve the process/state printer (a `Printer` function)
- `preparePrinter(config?)` — build a standalone `Printer`
- `setProcessTracer(process, print?)` — trace every transition of a process
- `setStateTracer(state, print?)` — trace a single state's lifecycle

## Migration from pre-0.35

Removed in 0.35:
- `FsmBaseClass.data`, `.setData()`, `.getData()` — use closures or context instead
- `FsmState.getData(key, recursive)`, `.useData(key)` — use closures
- `FsmBaseClass._runHandlerParallel()` — handlers run sequentially now
- `newFsmProcess()` — use `startProcess()` from orchestrator
- `utils/handlers.ts` (`addSubstateHandlers`, `callStateHandlers`) — pass a `load` callback to `startProcess()`
- `utils/process.ts` — use `startProcess()` directly
