# @statewalker/fsm

## 0.38.0

### Minor Changes

- **BREAKING** Removed the unused orchestration layer: `launcher` (`LauncherConfig`, `ProcessDef`, `KEY_LAUNCH_PROCESS`), the handler registry (`createHandlerRegistry`, `HandlerRegistry`, `toStageHandlers`), the `node-runner` bootstrap (`startProcesses`, `startNodeProcesses`), and the `fsm` CLI bin. These had no importers; the surviving `startProcess`/`startFsmProcess` runner + `StageHandler` type are unchanged.
- Dropped the `@deprecated` tag on `startFsmProcess` — it is a permanent equal alias of `startProcess`.
- Reorganized `src/`: the runner is now `src/start-process.ts` (was `src/orchestrator/`), and the debug utilities moved to `src/debug/` (was `src/utils/`). The transition-introspection queries (`getStateTransitions`, `isStateTransitionEnabled`) moved from the runner into `src/core/fsm-transitions.ts`, where they belong (read-only graph queries). Public `@statewalker/fsm` exports are identical.
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
