# @statewalker/fsm: Hierarchical Finite State Machine

A tiny, zero-dependency **hierarchical finite state machine (HFSM)** for TypeScript.
Declare a tree of nested states and event-driven transitions, attach behaviour to
each state, and drive the machine with events. The entire machine — its stack of
active states *and* the per-state data you record — can be dumped to a plain object
and restored, so a running process can be paused, persisted, and resumed later.

## Why it exists

Event-driven control flow — UI wizards, agent reasoning loops, connection/session
lifecycles, long-running workflows — is painful to express with ad-hoc booleans and
callbacks. It degrades into "am I in this phase yet? did that step already run? what
must unwind on cancel?".

This package lets you write that flow **declaratively** as a nested state tree and
attach behaviour per state. The engine owns the hard parts:

- **descending** into sub-states (entering a composite state auto-enters its initial child),
- **bubbling** an unhandled event up to the parent state,
- running **enter/exit hooks** in the correct order (exit unwinds inner-to-outer),
- **serializing** the whole machine for pause/resume.

It is deliberately small (a single bundled entry, **zero runtime dependencies**) so it
can sit at the core of larger systems without pulling weight.

There are **two layers — pick your altitude**:

- **Engine** (`FsmProcess` + `FsmState`) — the low-level machine you drive by hand with
  `dispatch(event)` and lifecycle hooks. Use it when you want full control.
- **Runner** (`startProcess`) — an ergonomic wrapper that attaches per-state handlers via
  a single `load` callback and binds the machine into a shared context object. **Most
  consumers use this.**

## Mental model

A `FsmProcess` keeps a **stack** of active states from the root down to the current leaf.
Dispatching an event resolves a transition, unwinds the states that exit, and enters the
states that become active — always leaving the stack resting on a leaf:

```
config (declarative)          runtime stack (one FsmProcess)
Player                        Player          ← root, always active
├─ Idle                       └─ Active       ← composite, entered on "play"
└─ Active (composite)            └─ Playing   ← leaf, the "current" state
   ├─ Playing
   └─ Paused         dispatch("pause"): exit Playing → enter Paused  (inside Active)
                     dispatch("stop") : neither Playing nor Active has a "stop" rule,
                                        so it bubbles to Player's "*"→Idle, unwinding
                                        Playing then Active
```

Transitions are `[from, event, to]` tuples. `""` means *initial* (as `from`) or *final*
(as `to`); `"*"` is a wildcard matching *any* state or *any* event. When the current leaf
has no matching rule, the lookup walks up the parent chain — that is how an event handled
only by an outer state still fires from deep inside.

## How to use

This package is consumed inside the workspace via `"@statewalker/fsm": "workspace:*"`.
Everything is exported from the package root:

```typescript
import { startProcess, FsmProcess, type FsmStateConfig } from "@statewalker/fsm";
```

### 1. Declare the machine — `FsmStateConfig`

```typescript
const config: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "", "Idle"],            // initial → Idle (eventless start)
    ["Idle", "play", "Active"],  // play → Active (which enters its initial child)
    ["*", "stop", "Idle"],       // from ANY state, "stop" → Idle
  ],
  states: [
    { key: "Idle" },
    {
      // A composite state: entering it descends into its initial child. The
      // initial rule uses "*" (any event) so descent works whatever event caused
      // the entry — here, "play".
      key: "Active",
      transitions: [
        ["", "*", "Playing"],           // initial child of Active
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
      ],
      states: [{ key: "Playing" }, { key: "Paused" }],
    },
  ],
};
```

### 2. Run it — `startProcess`

Pass a `load(stateKey, event)` callback that returns the handlers for each state. A handler
runs on enter; what it *returns* wires up the rest:

```typescript
const context: Record<string, unknown> = {};
await startProcess(context, config, (stateKey) => {
  if (stateKey === "Playing") {
    return [(ctx) => {
      console.log("▶ playing");
      return () => console.log("⏸ left Playing"); // returned fn → onExit cleanup
    }];
  }
  return [];
});

// startProcess binds control functions into `context`:
const dispatch = context["fsm:dispatch"] as (e: string) => Promise<void>;
await dispatch("play");   // Idle → Active → Playing → logs "▶ playing"
await dispatch("pause");  // Playing → Paused        → logs "⏸ left Playing"
```

A handler may instead return an **async generator** — each string it yields is dispatched
back into the machine, which is how a state drives its own timed/reactive transitions:

```typescript
// while in "Playing", emit a "pause" event after 1s:
return [async function* (ctx) {
  await new Promise((r) => setTimeout(r, 1000));
  yield "pause";
}];
```

### 3. Or drive the engine directly — `FsmProcess`

```typescript
const process = new FsmProcess(config);
process.onStateCreate((state) => {
  state.onEnter(() => console.log("→", state.key));
  state.onExit(() => console.log("←", state.key)); // runs inner-to-outer
});
await process.dispatch("");      // enter the initial state (Player → Idle)
await process.dispatch("play");  // Idle → Active → Playing
```

### 4. Pause & resume — `dump` / `restore`

```typescript
const snapshot = await process.dump();     // plain JSON-safe object
// ...persist it, ship it elsewhere, then on a fresh process:
await new FsmProcess(config).restore(snapshot);
```

To record your own per-state data in the snapshot, register `dump`/`restore` hooks on the
state (they receive a mutable `data` bag):

```typescript
state.dump((s, data) => { data.scrollTop = readScroll(); });
state.restore((s, data) => { applyScroll(data.scrollTop); });
```

### 5. Observe — printer & tracer

```typescript
import { setProcessPrinter, setProcessTracer } from "@statewalker/fsm";

setProcessPrinter(process, { prefix: "[player]", lineNumbers: true });
setProcessTracer(process); // logs <Playing event="play"> … </Playing> <!-- event="pause" --> per state
```

## API reference — what each export is for

**Configuration (the declarative vocabulary)**

- **`FsmStateConfig`** — one plain-object shape to declare an entire nested machine, so configs
  stay serializable, diffable, and toolable: a `key`, a list of `[from, event, to]` transition
  tuples, and optional nested `states`.
- **`STATE_INITIAL` / `STATE_FINAL` (`""`), `STATE_ANY` / `EVENT_ANY` (`"*"`), `EVENT_EMPTY` (`""`)**
  — named sentinels that make the meaning of the empty string and the wildcard explicit at the call
  site (`["", "start", "Active"]` reads as "from *initial*"). The runtime values are shared; the
  names document intent.

**Engine**

- **`FsmProcess`** — the running machine: it owns the active-state stack and the traversal algorithm.
  `dispatch(event)` advances the machine and resolves to a leaf; `shutdown(event?)` unwinds every
  active state; `state` is the current leaf; `onStateCreate(handler)` is the primary extension point
  (fires once per state instance); `dump()` / `restore(data)` serialize and rehydrate it.
- **`FsmState`** — a live node in the stack you hang behaviour on. It carries the `onEnter` / `onExit`
  (exit runs in reverse-registration, inner-to-outer) / `onStateError` lifecycle hooks and the `dump`
  / `restore` hooks for per-state data; `key` and `parent` locate it in the tree.
- **`FsmStateDescriptor`** — the *compiled* form of a config subtree, since resolving a transition at
  runtime must be cheap: an indexed transition table with wildcard-fallback lookup
  (`getTargetStateKey`). You rarely touch it directly; `FsmProcess` builds it for you.
- **`getStateTransitions(state)` / `isStateTransitionEnabled(process, event)`** — read-only queries
  over the graph for UIs, viewers, and dispatch guards ("which events are available here? will this
  event do anything?"). The first lists the currently-reachable `[from, event, to]` transitions
  (walking up the parent chain, nearest wins); the second is the boolean guard used internally before
  dispatching.
- **`FsmBaseClass` / `bindMethods`** — the shared handler-registry substrate under both `FsmProcess`
  and `FsmState` (add/run/remove typed handler lists, sequential with error routing). Mostly internal;
  exported for subclassing.

**Runner**

- **`startProcess` / `startFsmProcess`** — wiring `onStateCreate` + `onEnter` + a loader by hand is
  repetitive, so the runner does it once and binds the machine into a shared `context`: it creates the
  process, on each state entry calls `load(stateKey, event)` and installs the returned `StageHandler`s,
  and returns a `ProcessHandle`. `startFsmProcess` is a permanent equal alias.
- **`StageHandler`** — the contract for per-state behaviour, with its return type doing double duty: a
  function of `context` returning `void` (nothing), a cleanup `function` (→ `onExit`), or an async/sync
  generator (its yielded strings are dispatched as events).
- **`ProcessHandle`** — the caller's remote control after `startProcess` returns: `shutdown()`,
  `dump(...)`, `restore(dump, ...)`.
- **`KEY_DISPATCH` / `KEY_TERMINATE` / `KEY_STATES` / `KEY_EVENT`** — the context keys under which
  `startProcess` binds the dispatch fn, terminate fn, current state-stack, and last event, so handlers
  reach the machine through the shared context rather than closures over the process.

**Debug / observability**

- **`setProcessPrinter` / `getProcessPrinter` / `getPrinter` / `preparePrinter` (+ `Printer`,
  `PrinterConfig`)** — readable, hierarchy-indented logging you can attach without touching handler
  code: build or attach a `Printer` that prefixes each line with the current nesting depth (and
  optional line numbers).
- **`setProcessTracer` / `setStateTracer`** — see the machine's motion as a stream of enter/exit
  events: emit `<state event="…">` on enter and `</state>` on exit, for a whole process or a single
  state.

## Internals

- **Traversal & the `status` bitmask.** `dispatch` pumps an enter/exit cycle over the state stack until
  it rests on a leaf (`STATUS_LEAF`) or the machine finishes (`STATUS_FINISHED`). The `STATUS_*` bits
  encode where in that cycle the process is: `FIRST`/`NEXT` while entering (descending to a first child
  vs. advancing to a target), `LEAF` when settled, `LAST` when popping to a parent. Dispatching while
  the machine is already running just queues the next event (`nextEvent`) and returns — runs never
  re-enter.
- **Transition resolution order.** For `(state, event)` the descriptor tries, in order:
  `(state, event)` → `(*, event)` → `(state, *)` → `(*, *)`, then falls back to `STATE_FINAL`. Unhandled
  events bubble up the parent chain, so an outer state can catch events its children ignore.
- **Generator handlers.** A handler returning an async generator runs concurrently; its yielded events
  feed back through `dispatch`, and the generator is `return()`-ed automatically when its state exits —
  this is the mechanism for self-driving/timed states.
- **Serialization.** `dump()` walks root→leaf producing `{ status, event, stack: [{ key, data }] }`;
  `restore()` rebuilds the stack and replays each state's `restore` hooks. Only what you record via
  `state.dump(...)` is persisted — the engine keeps snapshots minimal.
- **Dependencies.** None. Zero runtime dependencies by design.

## License

MIT.

## Migration from pre-0.35

Removed in 0.35:
- `FsmBaseClass.data`, `.setData()`, `.getData()` — use closures or context instead
- `FsmState.getData(key, recursive)`, `.useData(key)` — use closures
- `FsmBaseClass._runHandlerParallel()` — handlers run sequentially now
- `newFsmProcess()` — use `startProcess()`
- `utils/handlers.ts` (`addSubstateHandlers`, `callStateHandlers`) — pass a `load` callback to `startProcess()`
- `utils/process.ts` — use `startProcess()` directly

Removed in 0.38 (see `CHANGELOG.md`): the unused orchestration layer (`launcher`,
`createHandlerRegistry`, the `fsm` CLI). Use `startProcess` + your own `load` callback.
