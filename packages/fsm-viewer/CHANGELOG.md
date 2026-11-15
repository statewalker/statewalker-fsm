# @statewalker/fsm-viewer

## 0.6.2

### Patch Changes

- Release of the changes since the last published version:
  
  - @statewalker/fsm ^0.39.2 -> ^0.39.3

## 0.6.1

### Patch Changes

- 6954d50: The pseudo-state keys travel with the built chart, and the engine decides which transitions are highlighted (#22). `buildFlatCharts` / `buildCharts` record `initialStateKey` and `finalStateKey` on the chart; `StateChartIndex`, `buildStatechartsPanel` and `buildStatechartSvg` read them from there, so a custom key no longer has to be passed to each of them (their options remain as deprecated overrides). The new `StateChartIndex.getTransitionEdges(stack, transitions)` maps the engine's `[from, event, to]` tuples to drawn edges, and the viewer uses it instead of its own mapping.
- Updated dependencies [6954d50]
- Updated dependencies [a15dd3f]
- Updated dependencies [568b851]
  - @statewalker/fsm-charts@0.2.9
  - @statewalker/fsm@0.39.2

## 0.6.0

### Minor Changes

- 84ff762: fsm-viewer: keep `@statewalker/fsm` and `@statewalker/fsm-charts` external, so the
  types accept an `FsmProcess` from `@statewalker/fsm` and the bundle no longer carries
  a copy of them; highlight exactly the engine's enabled transitions (wildcard sources
  included) and dispatch an edge click only for one of them; the `renderer` option takes
  key stacks (the renderer of `prepareStateDescriptions`) and runs once per state; the
  returned element has `dispose()`, also called on `invalidation`, which releases the
  listeners and the process subscription. fsm-charts: `StateChartIndex.findTransition`.

### Patch Changes

- Updated dependencies [ea31027]
- Updated dependencies [e5db740]
- Updated dependencies [84ff762]
  - @statewalker/fsm-charts@0.2.8
  - @statewalker/fsm@0.39.1

## 0.5.0

### Minor Changes

- ab7e6d2: `renderStateCharts`, `renderStateDescription` and the state renderer accept either
  `FsmProcess` or `FsmProcessSync` (the viewer's handlers are now synchronous, so the sync
  engine no longer reports them as errors). `renderStateDescription` takes an optional
  `invalidation` promise to stop following the process.

### Patch Changes

- Updated dependencies
- Updated dependencies [4484089]
  - @statewalker/fsm-charts@0.2.7
  - @statewalker/fsm@0.39.0

## 0.4.4

### Patch Changes

- Release of the changes since the last published version:
  
  - files changed: README.md, dist/index.d.ts, dist/index.d.ts.map, dist/index.js, dist/index.js.map, 7 more
- Updated dependencies
- Updated dependencies
  - @statewalker/fsm-charts@0.2.6
  - @statewalker/fsm@0.38.2

## 0.4.2

### Patch Changes

Bug fixes found by an adversarial review:

- **State descriptions were never removed on exit and accumulated.**
  `renderStateDescription` appended the renderer's `DocumentFragment` with `appendChild`,
  which empties the fragment — so its `parentElement` was always `null` and the exit
  cleanup was a no-op. It now snapshots the appended nodes and removes those.
- **Teardown wiring.** `renderStateCharts` discarded the `_addStateRenderer` disposer and
  never passed `invalidation` to `newProcessCharts`, so the per-state subscription and the
  chart click-listeners leaked. Both are now threaded through `invalidation`, and
  `renderProcess` awaits `process.shutdown("exit")` before removing the chart.

Rebuilt against `@statewalker/fsm@0.38.1` and `@statewalker/fsm-charts@0.2.5`.

## 0.4.1

### Patch Changes

- Fix a broken publish: 0.4.0 was published (via `npm publish`, which does not rewrite
  pnpm's `workspace:` protocol) with `@statewalker/fsm` and `@statewalker/fsm-charts`
  declared as `dependencies: "workspace:*"`, making `npm install @statewalker/fsm-viewer`
  fail with `EUNSUPPORTEDPROTOCOL`. Those two are **bundled** into `dist` (tsup
  `noExternal`), so they are moved to `devDependencies` — the published package now
  declares no runtime dependencies and installs cleanly.

## 0.4.0

### Minor Changes

- Repaired the build so the package is publishable again:
  - `tsconfig.json` was extending `@statewalker/typescript-config/base.json`, which is
    not a dependency — inlined a self-contained config (matching the strictness the
    package actually passes; added `ignoreDeprecations: "6.0"` for the TS 6 `baseUrl`
    deprecation).
  - `vitest.config.ts` imported `defineConfig` from `vite` (not installed) — switched
    to `vitest/config`.
  - Build scripts used `yarn`; the monorepo is on pnpm — `build`/`prepublish`/`lint:fix`
    now use `pnpm`.
- Fixed the `docs/renderProcess.ts` example to use the real `@statewalker/fsm` API
  (`new FsmProcess` + `setProcessPrinter`) instead of the never-existent
  `newProcess`/`FsmProcessConfig`; `lodash` → `lodash-es`.
- Build now emits `dist/index.js` + `dist/index.d.ts` with `@statewalker/fsm` and
  `@statewalker/fsm-charts` bundled in. Tests: 141 pass.
