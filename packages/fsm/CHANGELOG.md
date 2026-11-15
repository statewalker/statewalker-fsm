# @statewalker/fsm

## 0.39.1

### Patch Changes

- e5db740: - The runners' dispatch guard is checked when an event is applied, not when it is queued: an event dispatched while the machine is busy no longer unwinds it when it lands in a state with no rule for it (new optional `eventFilter` on `FsmProcess` / `FsmProcessSync`).
  - `getStateTransitions` follows `dispatch`: an inner exit-to-final rule no longer hides the outer rule the event bubbles to, and an inner wildcard-event rule hides the outer rules.
  - `restore` throws on a dump whose root key differs from the machine's.

## 0.39.0

### Minor Changes

- 4484089: Add a synchronous engine (`FsmProcessSync`, `FsmStateSync`, `FsmBaseClassSync`) and runner
  (`startProcessSync`) built on the same traversal as the async engine; `ProcessHandle` gains
  `dispatch`, `FsmProcess` gains `whenIdle()`.
  
  Fixes:
  - handlers added while a handler list runs no longer disturb it (an `onExit` adding an
    `onExit` looped forever);
  - events sent to a finished machine are no longer queued;
  - `shutdown()` requested from a handler or during a dispatch no longer recurses, deadlocks,
    exits states twice or revives the machine: it is recorded and applied by the running
    dispatch once the current handler returns (every entered state exits exactly once);
  - the async runner applies generator events once the machine has settled, like the sync
    runner (a generator on a composite state no longer loses its first event);
  - the runner's `restore` unwinds the live stack first.
  
  Behaviour/type changes to check when upgrading:
  - `FsmStateDumpHandler`'s second parameter is now typed as the state's `data` bag (what is
    passed at runtime) instead of `FsmStateDump`; code written against the old type no longer
    compiles.
  - `shutdown()` on a machine that never started finishes it (a later `dispatch` is a no-op).
  - `shutdown()` called while the machine is busy resolves immediately; use `whenIdle()` to
    wait for the unwinding. A ProcessHandle's `shutdown()` / `restore()` wait for an in-flight
    dispatch and resolve once done — call them from outside the machine (`KEY_TERMINATE` is the
    non-waiting variant for handlers).
  - `restore()` throws when called while a dispatch or shutdown is running.
  - A ProcessHandle's `restore` runs the `onExit` handlers of the states it replaces.

## 0.38.2

### Patch Changes

- Release of the changes since the last published version:
  
  - files changed: README.md, dist/index.d.ts, dist/index.d.ts.map, dist/index.js.map, src/core/fsm-process.ts, 5 more

## 0.38.1

### Patch Changes

Bug fixes found by an adversarial review:

- **`isStateTransitionEnabled` / `startProcess` dropped wildcard-event transitions.** The
  runner's dispatch guard compared events by exact string, so a concrete event that only
  matched a wildcard rule (e.g. `["A","*","B"]`) was classified as "dead" and silently
  swallowed — even though the raw engine takes it. The guard now also accepts `EVENT_ANY`.
- **A throwing `onStateError` handler caused infinite recursion (stack overflow).**
  `FsmState._handleError` ran the error handlers through `_runHandler`, whose catch
  re-entered `_handleError` → `onStateError` forever. Error handlers now run with a
  terminal `catch`, no re-entry.
- **Re-entrant dispatches during one settle cycle dropped all but the last event.** The
  single `nextEvent` slot is replaced by a `nextEvents` FIFO queue, drained in order.

## 0.38.0

### Minor Changes

- **BREAKING** Removed the unused orchestration layer: `launcher` (`LauncherConfig`, `ProcessDef`, `KEY_LAUNCH_PROCESS`), the handler registry (`createHandlerRegistry`, `HandlerRegistry`, `toStageHandlers`), the `node-runner` bootstrap (`startProcesses`, `startNodeProcesses`), and the `fsm` CLI bin. These had no importers; the surviving `startProcess`/`startFsmProcess` runner + `StageHandler` type are unchanged.
- Dropped the `@deprecated` tag on `startFsmProcess` — it is a permanent equal alias of `startProcess`.
- Reorganized `src/`: the runner is now `src/start-process.ts` (was `src/orchestrator/`), and the debug/observability utilities moved to `src/trace/` (was `src/utils/`). The transition-introspection queries (`getStateTransitions`, `isStateTransitionEnabled`) moved from the runner into `src/core/fsm-transitions.ts`, where they belong (read-only graph queries). Public `@statewalker/fsm` exports are identical.
- Removed the unresolvable `./*` subpath export (the package ships a single bundled entry).

## 0.37.0

### Minor Changes

- Simplified core: removed obsolete modules (process-config-manager, constants, types, etc.)
- Added `ProcessHandle` return type for `startProcess` with `shutdown()`, `dump()`, and `restore()` methods
- Added handler registry with pattern-based handler discovery (`createHandlerRegistry`, `toStageHandlers`)
- Added comprehensive test suite: FsmBaseClass, FsmState, FsmStateDescriptor, FsmProcess, async process lifecycle, orchestrator dump/restore (89 tests)
- Migrated build tooling from tsup to tsdown, yarn to pnpm
- Zero runtime dependencies

## 0.16.0

### Minor Changes

- Fix logical bug in transitions loading

## 0.15.2

### Patch Changes

- Update rollup and dependencies
- Updated dependencies
  - @statewalker/tree@0.10.2

## 0.15.1

### Patch Changes

- Normalize package.json files
- Updated dependencies
  - @statewalker/tree@0.10.1

## 0.15.0

### Minor Changes

- Migrage the "initAsyncProcess" method from the @statewalker/fsm to @statewalker/fsm-process package and add process utility methods

## 0.14.0

### Minor Changes

- Update exports

## 0.13.0

### Minor Changes

- Fix exports

## 0.12.0

### Minor Changes

- Update version

## 0.11.0

### Minor Changes

- Add initialization function for async processes

## 0.10.1

### Patch Changes

- Migrate the @statewalker/fsm project from the @statewalker/statewalker monorepo
