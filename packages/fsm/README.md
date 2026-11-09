# @statewalker/fsm

## What it is: a small hierarchical state machine you can pause and resume

A tiny, zero-dependency **hierarchical finite state machine (HFSM)** for TypeScript.
Declare a tree of nested states and event-driven transitions, attach behaviour to
each state, and drive the machine with events. The entire machine — its stack of
active states *and* the per-state data you record — can be dumped to a plain object
and restored, so a running process can be paused, persisted, and resumed later.

It ships in two flavours that run **the same traversal algorithm**: an **async**
engine whose handlers may `await`, and a **sync** engine that has fully moved by the
time `dispatch` returns.

## Why it exists: event-driven flows outgrow flags and callbacks

Event-driven control flow — UI wizards, agent reasoning loops, connection/session
lifecycles, long-running workflows, parsers — is painful to express with ad-hoc
booleans and callbacks. It degrades into "am I in this phase yet? did that step
already run? what must unwind on cancel?".

This package lets you write that flow **declaratively** as a nested state tree and
attach behaviour per state. The engine owns the hard parts:

- **descending** into sub-states (entering a composite state auto-enters its initial child),
- **bubbling** an unhandled event up to the parent state,
- running **enter/exit hooks** in the correct order (exit unwinds inner-to-outer),
- **serializing** the whole machine for pause/resume.

It is deliberately small (a single bundled entry, **zero runtime dependencies**) so it
can sit at the core of larger systems without pulling weight.

## Two layers × two flavours

|  | **async** (handlers may return promises) | **sync** (plain functions, no promises) |
| --- | --- | --- |
| **Engine** — drive it by hand with `dispatch(event)` and lifecycle hooks | `FsmProcess`, `FsmState` | `FsmProcessSync`, `FsmStateSync` |
| **Runner** — per-state handlers from one `load` callback, machine bound into a context object. **Most consumers use this.** | `startProcess` → `ProcessHandle` | `startProcessSync` → `ProcessHandleSync` |

Configs, dumps, introspection (`getStateTransitions`, `isStateTransitionEnabled`) and the
tracer/printer utilities are shared by both flavours. A dump taken from one engine can be
restored into the other.

### Choosing a flavour

| Use case | Pick | Why |
| --- | --- | --- |
| Network/session lifecycles, workflows calling services, agent loops, timers | **async** | handlers `await` I/O; generators can wait on timers and streams |
| UI wizards and screen flows whose steps fetch or save data | **async** | same — an `onEnter` can load data before the state settles |
| Tokenizers, parsers, protocol decoders (one event per symbol) | **sync** | no promise per event; result is ready when the loop ends |
| Reducers, game loops, simulations, server-side rendering | **sync** | the state is consistent immediately after `dispatch` — no `await` points |
| Unit tests of a machine's logic | **sync** | deterministic, no async plumbing; the same handlers can then run on the async runner |
| Pause in one place, resume in another (browser → server) | **both** | dumps are plain data and interchangeable between engines |

Rule of thumb: if any handler needs to `await`, use the async flavour; otherwise the sync one
is simpler and faster. Synchronous handlers work on both runners (see example 9 below).

## How to use: install, then drive it with the runner or the engine

```sh
pnpm add @statewalker/fsm
```

No peer or runtime dependencies. The package is ESM-only and has a single entry point,
`@statewalker/fsm` (`dist/index.js` with `.d.ts` types; the TypeScript sources are
published in `src/`). It uses no DOM or Node-specific APIs, so it runs in browsers,
Node.js and workers.

Everything is exported from the package root:

```typescript
import { startProcess, startProcessSync, FsmProcess, FsmProcessSync, type FsmStateConfig } from "@statewalker/fsm";
```

### The machine is a stack of active states

A process keeps a **stack** of active states from the root down to the current leaf.
Dispatching an event resolves a transition, unwinds the states that exit, and enters the
states that become active — always leaving the stack resting on a leaf:

```
config (declarative)          runtime stack (one process)
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
has no matching rule, it exits (its target is *final*) and the parent's rules are checked
for the same event, and so on up the tree. That is how an event handled only by an outer
state still fires from deep inside — and also why an event that **nobody** handles unwinds
the whole machine (the runners guard against that; see "Constraints" below).

### What each export is for

**Configuration (the declarative vocabulary — shared)**

- **`FsmStateConfig`** — one plain-object shape to declare an entire nested machine, so configs
  stay serializable, diffable, and toolable: a `key`, a list of `[from, event, to]` transition
  tuples, and optional nested `states`. Extra fields (e.g. `description`) are allowed.
- **`STATE_INITIAL` / `STATE_FINAL` (`""`), `STATE_ANY` / `EVENT_ANY` (`"*"`), `EVENT_EMPTY` (`""`)**
  — named sentinels that make the meaning of the empty string and the wildcard explicit at the call
  site (`["", "start", "Active"]` reads as "from *initial*"). The runtime values are shared; the
  names document intent.

**Async engine**

- **`FsmProcess`** — the running machine: it owns the active-state stack and drives the traversal.
  - `dispatch(event)` advances the machine until it rests on a leaf; resolves to `false` once the
    machine has finished (`true` otherwise). Called while a dispatch is running (e.g. from a
    handler), it queues the event and returns at once; queued events run in order before the
    outer `dispatch` resolves.
  - `shutdown(event?)` unwinds every active state (inner-to-outer) and finishes the machine.
    Called while the machine is busy (from a handler, or during a dispatch or another
    shutdown), it only records the request and resolves at once — so awaiting it inside a
    handler cannot deadlock; the running dispatch unwinds as soon as the current handler
    returns. Every entered state is exited exactly once.
  - `whenIdle()` resolves once no dispatch or shutdown is in progress.
  - `dump(...args)` / `restore(dump, ...args)` serialize and rehydrate the stack.
  - `onStateCreate(handler)` is the primary extension point (fires once per state instance —
    attach that state's hooks there); `onStateError(handler)` receives every error thrown by a
    state's handlers (`onEnter`, `onExit`, `dump`, `restore`). Errors thrown by process-level
    handlers (`onStateCreate`) are only logged.
  - `state` is the current leaf, `event` the event being processed, `status` the `STATUS_*` bits.
  - `dispatch`, `shutdown`, `dump`, `restore` and `whenIdle` are pre-bound, so they can be passed
    as callbacks.
- **`FsmState`** — a live node in the stack you hang behaviour on: `onEnter` / `onExit` (exit
  handlers run in reverse registration order, so unwinding is inner-to-outer) / `onStateError`
  lifecycle hooks and `dump` / `restore` hooks for per-state data; `key`, `parent`, `descriptor` and
  `process` locate it. Every hook method returns a disposer.
- **`FsmStateHandler`, `FsmStateDumpHandler`, `FsmStateErrorHandler`, `FsmProcessHandler`,
  `FsmProcessDump`, `FsmStateDump`** — the corresponding types.

**Sync engine**

- **`FsmProcessSync` / `FsmStateSync`** — synchronous twins with the same members:
  `dispatch(event)` returns a `boolean`, `dump()` returns the dump, `restore()` returns the process,
  `shutdown()` returns when the stack is unwound — or, called from a handler, records the request,
  which the running dispatch applies once that handler returns (same rule as `FsmProcess`).
  Handlers are plain functions; one that returns a promise cannot be honoured synchronously and is
  reported as a `TypeError` through `onStateError`.
- **`FsmStateSyncHandler`, `FsmStateSyncDumpHandler`, `FsmStateSyncErrorHandler`,
  `FsmProcessSyncStateHandler`** — the corresponding types.

**Shared internals (exported for tooling and subclassing)**

- **`FsmStateDescriptor`** — the *compiled* form of a config subtree, since resolving a transition at
  runtime must be cheap: an indexed transition table with wildcard-fallback lookup
  (`getTargetStateKey`). You rarely touch it directly; both engines build it for you.
- **`STATUS_*`, `getNextStateTarget`, `settleStep`, `resolveTargetStateKey`, `findStateDescriptor`,
  `getSubstateTarget`, `FsmStateNode`, `FsmStateTarget`** — the pure traversal steps
  (`src/core/fsm-traversal.ts`) both engines are built from, which is what guarantees they visit
  states in the same order.
- **`FsmHandlers` / `FsmBaseClass` / `FsmBaseClassSync` / `bindMethods` / `isThenable`** — the
  handler-registry substrate: `FsmHandlers` stores named handler lists; `FsmBaseClass` runs them
  sequentially awaiting each, `FsmBaseClassSync` runs them synchronously; both route a throwing
  handler to `_handleError` instead of aborting the batch.

**Introspection (shared)**

- **`getStateTransitions(state)` / `isStateTransitionEnabled(process, event)`** — read-only queries
  over the graph for UIs, viewers, and dispatch guards ("which events are available here? will this
  event do anything?"). The first lists the currently-reachable `[from, event, to]` transitions
  (walking up the parent chain, nearest wins, ordered outer→inner); the second is the boolean guard
  used by the runners before dispatching. Both accept either engine.

**Runners**

- **`startProcess(context, config, load, startEvent = "")` / `startFsmProcess`** — wiring
  `onStateCreate` + `onEnter` + a loader by hand is repetitive, so the runner does it once: it
  creates an `FsmProcess`, on each state entry calls `load(stateKey, event)` (which may be async)
  and installs the returned `StageHandler`s, binds the machine into `context`, dispatches
  `startEvent`, and resolves to a `ProcessHandle`. `startFsmProcess` is an alias.
- **`StageHandler`** — per-state behaviour, a function of `context` whose return value wires up the
  rest: nothing; a cleanup `function` (→ `onExit`); or an async/sync generator whose yielded strings
  are dispatched as events. The generator runs concurrently with the caller; each yielded event is
  applied once the machine has settled, and the generator is `return()`-ed when its state exits.
- **`ProcessHandle`** — `dispatch(event)` (guarded, like `KEY_DISPATCH`), `shutdown()`, `dump(...)`,
  `restore(dump, ...)`, all returning promises.
- **`startProcessSync(context, config, load, startEvent = "")`** — the same runner on
  `FsmProcessSync`; `load` must be synchronous. Returns a `ProcessHandleSync` with the same four
  methods, returning values directly. An async stage handler or async generator returned to it is
  reported as a `TypeError` (through the state's error handling) instead of being ignored.
- **`StageHandlerSync`** — like `StageHandler` without promises: nothing, a cleanup function, or a
  **sync generator**. The generator starts on entry (code before its first `yield` runs then); each
  yielded event is dispatched once the machine has settled, and the next value is pulled after that
  event has been processed. A `StageHandlerSync` is also a valid `StageHandler`.
- **`KEY_DISPATCH` / `KEY_TERMINATE` / `KEY_STATES` / `KEY_EVENT`** — the context keys under which
  both runners bind the guarded dispatch fn, the terminate fn, the current state-key stack (root→leaf)
  and the last event, so handlers reach the machine through the shared context. The bound dispatch
  fn ignores events for which `isStateTransitionEnabled` returns `false`.

**Debug / observability (shared)**

- **`setProcessPrinter` / `getProcessPrinter` / `getPrinter` / `preparePrinter` (+ `Printer`,
  `PrinterConfig`, `FsmAnyProcess`)** — readable, hierarchy-indented logging you can attach without
  touching handler code: build or attach a `Printer` that prefixes each line with a `prefix`, the
  current nesting depth, and optional line numbers; `print` overrides the sink (default
  `console.log`).
- **`setProcessTracer` / `setStateTracer`** — see the machine's motion as a stream of enter/exit
  events: emit `<state event="…">` on enter and `</state> <!-- event="…" -->` on exit, for a whole
  process or a single state. Works with either engine.

## Examples

Every snippet below is exercised by `test/readme.test.ts`. They share this config:

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

### 2. Drive the engine directly — `FsmProcess` / `FsmProcessSync`

**Async** — handlers may be `async`; each `dispatch` resolves once the machine has settled:

```typescript
const fsm = new FsmProcess(config);
fsm.onStateCreate((state) => {
  state.onEnter(async () => {
    await saveVisit(state.key);              // e.g. I/O before the state settles
  });
  state.onExit(() => console.log("←", state.key)); // runs inner-to-outer
});
await fsm.dispatch("");      // enter the initial state (Player → Idle)
await fsm.dispatch("play");  // Idle → Active → Playing
fsm.state?.key;              // "Playing"
await fsm.dispatch("stop");  // bubbles to Player's "*"→Idle: logs ← Playing, ← Active
await fsm.shutdown();        // unwinds Idle, then Player; dispatch now resolves to false
```

**Sync** — the same machine, no promises; the state is current when `dispatch` returns:

```typescript
const fsm = new FsmProcessSync(config);
fsm.onStateCreate((state) => {
  state.onEnter(() => console.log("→", state.key));
  state.onExit(() => console.log("←", state.key));
});
fsm.dispatch("");      // true — already resting on Player/Idle
fsm.dispatch("play");  // true
fsm.state?.key;        // "Playing"
fsm.dispatch("stop");  // back to Idle
fsm.shutdown();
fsm.dispatch("play");  // false — finished
```

### 3. Run it — `startProcess` / `startProcessSync`

Pass a `load(stateKey, event)` callback that returns the handlers for each state. A handler
runs on enter; what it *returns* wires up the rest.

**Async:**

```typescript
const context: Record<string, unknown> = {};
const handle = await startProcess(context, config, async (stateKey) => {
  if (stateKey === "Playing") {
    return [(ctx) => {
      console.log("▶ playing");
      return () => console.log("⏸ left Playing"); // returned fn → onExit cleanup
    }];
  }
  return [];
});
await handle.dispatch("play");   // Idle → Active → Playing → logs "▶ playing"
await handle.dispatch("pause");  // Playing → Paused        → logs "⏸ left Playing"
context[KEY_STATES];             // ["Player", "Active", "Paused"]
await handle.dispatch("bogus");  // no rule here → ignored (the machine is NOT unwound)
await handle.shutdown();
```

**Sync** — identical shape, no `await`:

```typescript
const context: Record<string, unknown> = {};
const handle = startProcessSync(context, config, (stateKey) =>
  stateKey === "Playing" ? [() => () => console.log("⏸ left Playing")] : [],
);
handle.dispatch("play");
handle.dispatch("pause");
context[KEY_STATES];   // ["Player", "Active", "Paused"]
handle.shutdown();
```

Handlers can also reach the machine through the context:
`(context[KEY_DISPATCH] as (e: string) => void)("stop")`, `context[KEY_TERMINATE]`, and
`context[KEY_EVENT]` (the last event).

### 4. Self-driving states — generators

A stage handler may return a generator; each string it yields is dispatched back into the
machine, and the generator is `return()`-ed automatically when its state exits.

**Async** — an async generator runs concurrently with the caller, so it can wait on timers,
sockets or streams:

```typescript
// while in "Playing", emit "pause" after 1s:
const handle = await startProcess(context, config, (stateKey) =>
  stateKey === "Playing"
    ? [async function* () {
        await new Promise((r) => setTimeout(r, 1000));
        yield "pause";
      }]
    : [],
);
await handle.dispatch("play");  // resolves now; "pause" arrives ~1s later
```

**Sync** — a sync generator scripts a sequence of steps; every event it yields has been
applied before `dispatch` returns:

```typescript
const handle = startProcessSync(context, config, (stateKey) =>
  stateKey === "Playing" ? [function* () { yield "pause"; }] : [],
);
handle.dispatch("play");
context[KEY_STATES];  // ["Player", "Active", "Paused"] — the generator already ran
```

Both runners apply a generator's event only once the machine has settled (so a generator on a
composite state sees its initial child entered first), and pull the next value after that event
has been processed. On the **async** runner this happens asynchronously: do not rely on the
events having been applied when `dispatch` resolves. On the **sync** runner, a generator must
eventually finish or leave its state — an endless one would keep `dispatch` from returning.

### 5. Errors — `onStateError`

A throwing handler never rejects/throws from `dispatch`. The error goes to the state's
`onStateError` handlers, then the process's, then `console.error`; the transition continues.
This is the same on both engines:

```typescript
const fsm = new FsmProcess(config);          // or new FsmProcessSync(config)
fsm.onStateError((state, error) => report(state.key, error));
fsm.onStateCreate((state) => {
  state.onEnter(() => { if (state.key === "Idle") throw new Error("boom"); });
});
await fsm.dispatch("");                      // resolves true; report("Idle", Error("boom"))
```

Sync engine only — an `async` handler is a mistake there, and is reported as a `TypeError`:

```typescript
const fsm = new FsmProcessSync(config);
fsm.onStateError((state, error) => report(state.key, error)); // error instanceof TypeError
fsm.onStateCreate((state) => state.onEnter(async () => {}));  // ✗ not awaited → reported
fsm.dispatch("");
```

### 6. Pause & resume — `dump` / `restore`

```typescript
// async
const snapshot = await fsm.dump();                   // plain JSON-safe object
await new FsmProcess(config).restore(snapshot);

// sync
const snapshot2 = fsmSync.dump();
new FsmProcessSync(config).restore(snapshot2);

// across engines — dumps are interchangeable
new FsmProcessSync(config).restore(await fsm.dump());
await new FsmProcess(config).restore(fsmSync.dump());
```

To record your own per-state data, register `dump` / `restore` hooks on the state. They receive
the state's mutable `data` bag, followed by any extra arguments given to `dump(...)` /
`restore(dump, ...)`:

```typescript
state.dump((s, data, storage) => { data.scrollTop = readScroll(); });
state.restore((s, data, storage) => { applyScroll(data.scrollTop as number); });
```

Through a runner handle: `await handle.dump()` / `await handle.restore(snapshot)` (async) or
`handle.dump()` / `handle.restore(snapshot)` (sync). A handle's `restore` first unwinds the live
stack (cleanups run, generators stop). Restored states fire `onStateCreate` and their `restore`
hooks but **not** `onEnter`, so the runner's `load` handlers are not re-run for them.

### 7. Introspection — which events are available?

```typescript
// with either engine, resting on Player/Active/Playing:
getStateTransitions(fsm.state);
// [["Active", "stop", "Idle"], ["Playing", "pause", "Paused"]]   (outer → inner)
isStateTransitionEnabled(fsm, "pause");  // true
isStateTransitionEnabled(fsm, "bogus");  // false — dispatching it would unwind the machine
```

### 8. Observe — printer & tracer

```typescript
import { setProcessPrinter, setProcessTracer } from "@statewalker/fsm";

const lines: string[] = [];
const print = (...parts: unknown[]) => lines.push(parts.join(""));
setProcessPrinter(fsm, { prefix: "[player]", lineNumbers: true, print }); // fsm: either engine
setProcessTracer(fsm);
fsm.dispatch("");      // (await it on the async engine)
fsm.dispatch("play");
// lines:
// [player][1]<Player event="">
// [player][2]  <Idle event="">
// [player][3]  </Idle> <!-- event="play" -->
// [player][4]  <Active event="play">
// ...
```

Without `print`, lines go to `console.log`, which separates the prefix, counter and text with
spaces.

### 9. Write handlers once, run them on either runner

A `StageHandlerSync` is also a valid async `StageHandler`, so a synchronous handler set can be
tested on `startProcessSync` and deployed on `startProcess` (or the other way round). Both produce
the same sequence of enters, exits and cleanups — including the events of a sync generator (on the
async runner, after its events have been processed). With several generators active at the same
time, the interleaving of their events may differ between the runners.

```typescript
const handlers: Record<string, StageHandlerSync<Ctx>> = {
  Playing: (ctx) => { ctx.log.push("play"); return () => ctx.log.push("stop"); },
};
const load = (key: string) => (handlers[key] ? [handlers[key]] : []);

startProcessSync(ctxA, config, load);        // sync
await startProcess(ctxB, config, load);      // async — same handlers
```

### More: runnable examples

[`examples/`](./examples) holds runnable use cases (`node examples/<file>.ts` on Node ≥ 22.18,
which strips TypeScript types natively). Each one is executed by `test/examples.test.ts`.

| File | Flavour | Use case / what it shows |
| --- | --- | --- |
| `01-traffic-light.ts` | sync engine | composite state, fault bubbling, guarding events with `isStateTransitionEnabled`, tracer |
| `02-signup-wizard.ts` | sync runner | UI wizard: per-state handlers, cleanups, a generator state, back/cancel from any step |
| `03-csv-parser.ts` | sync engine | character-level tokenizer; syntax errors detected through unmatched events |
| `04-async-reconnect.ts` | async runner | network client: async generators for connect, back-off/retry, give up |
| `05-pause-and-resume.ts` | sync → async | checkout snapshot to JSON in one session, resumed on the async engine in another |
| `06-async-order-workflow.ts` | async engine | service workflow: `async` `onEnter` steps, queued dispatch, errors → events via `onStateError`, printer |
| `07-one-machine-two-engines.ts` | both runners | one `StageHandlerSync` set run on `startProcessSync` and `startProcess`, identical transcripts |

## Internals: traversal, transition lookup and serialization

- **One algorithm, two drivers.** Each traversal step is split into pure functions in
  `fsm-traversal.ts`: `getNextStateTarget` decides which state to create next, `settleStep` computes
  the resulting `[state, status]`. `FsmProcess` and `FsmProcessSync` only differ in whether they
  `await` handlers between those steps.
- **Traversal & the `status` bitmask.** `dispatch` pumps an enter/exit cycle over the state stack until
  it rests on a leaf (`STATUS_LEAF`, the default `mask`) or the machine finishes (`STATUS_FINISHED`).
  The `STATUS_*` bits encode where in that cycle the process is: `FIRST`/`NEXT` while entering
  (descending to a first child vs. advancing to a target), `LEAF` when settled, `LAST` when popping to
  a parent. Dispatching while the machine is already running appends the event to the `nextEvents`
  FIFO queue and returns; the queued events are applied in order when the current run settles. Runs
  never nest.
- **Transition resolution order.** For `(state, event)` the parent's descriptor tries, in order:
  `(state, event)` → `(*, event)` → `(state, *)` → `(*, *)`, then falls back to `STATE_FINAL`.
  Unhandled events bubble up the parent chain, so an outer state can catch events its children
  ignore. A state key not declared under its parent is looked up in the ancestors' `states`;
  unknown keys behave as plain leaves.
- **Generator handlers.** Async runner: a generator is consumed concurrently; before each yielded
  event goes through the guarded dispatch, it waits for `whenIdle()`. Sync runner: generators are
  pumped round-robin after each settle, one event per generator per pass. Either way the generator
  is `return()`-ed when its state exits — also when it leaves its own state from its body — which
  is the mechanism for self-driving/timed states.
- **Shutdown while busy.** `shutdown()` during a dispatch sets a request; the dispatch loop checks
  it after every handler and step, discards a state that was being created, and unwinds from the
  current state (or from its parent if that state has just exited).
- **Handler lists.** Handlers run in registration order (`onExit`: reverse), over a snapshot of the
  list taken when the run starts — a handler registered while its list is running (e.g. an
  `onEnter` adding another `onEnter`) takes effect from the next run.
- **Serialization.** `dump()` walks root→leaf producing `{ status, event, stack: [{ key, data }] }`;
  `restore()` rebuilds the stack (firing `onStateCreate`) and replays each state's `restore` hooks.
  Only what you record via `state.dump(...)` is persisted — the engine keeps snapshots minimal. The
  format is the same for both engines.
- **Constraints and quiet failures.**
  - Once the root state exits (or after `shutdown()`, even on a machine that never started),
    the process is finished: `dispatch` returns/resolves `false` and does nothing; queued events
    are discarded. Create a new process (or `restore` a dump) to run again.
  - With the raw engines, an event that matches no rule exits the current state and keeps
    bubbling — if no ancestor handles it, the whole machine finishes. Guard with
    `isStateTransitionEnabled` (the runners do).
  - The runners' dispatch (`handle.dispatch`, `KEY_DISPATCH`) drops events for which
    `isStateTransitionEnabled` is `false`, without an error. Call `isStateTransitionEnabled`
    yourself when you need to know.
  - A re-entrant `dispatch` (from inside a handler) only queues: it returns `true` before the
    event has been applied.
  - An error thrown by a state's handler does not reject/throw from `dispatch`. It goes to the
    state's `onStateError` handlers, then to the process's `onStateError` handlers, and is then
    logged with `console.error`; the transition continues. An error thrown by an
    `onStateError` or `onStateCreate` handler is only logged.
  - `FsmProcess.restore` / `FsmProcessSync.restore` replace the current stack without running its
    `onExit` handlers — call `shutdown()` first if they must run (the runner handles do this).
    Calling `restore` while a dispatch or shutdown is running throws.
- **Dependencies.** None. Zero runtime dependencies, so the package can sit at the core of
  larger systems without adding to their install.

## License

MIT.
