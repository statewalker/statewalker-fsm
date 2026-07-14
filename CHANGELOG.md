# @statewalker/fsm-viewer

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
