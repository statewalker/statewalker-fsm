# StateWalker FSM

## What it is

A pnpm workspace with four npm packages for hierarchical finite state machines (HFSM) in
TypeScript: the runtime, a configuration validator, a statechart layout and rendering
library, and a browser viewer. Each package is published on its own and can be used
without the others.

## The four packages and how they depend on each other

| Package | What it does | npm |
| --- | --- | --- |
| [`@statewalker/fsm`](packages/fsm) | HFSM runtime: nested states, event-driven transitions, per-state behaviour, dump/restore of a running process. Zero dependencies. | [npm](https://www.npmjs.com/package/@statewalker/fsm) |
| [`@statewalker/fsm-validator`](packages/fsm-validator) | Checks HFSM configurations against 25 lexical, structural and semantic rules, formats reports, and exports prompt texts for AI agents that write HFSM configs. Zero dependencies. | [npm](https://www.npmjs.com/package/@statewalker/fsm-validator) |
| [`@statewalker/fsm-charts`](packages/fsm-charts) | Lays out a configuration as a statechart (vendored dagre), writes SVG/HTML and CSS, and highlights states on the rendered chart. Zero dependencies; lodash is passed in by the caller. | [npm](https://www.npmjs.com/package/@statewalker/fsm-charts) |
| [`@statewalker/fsm-viewer`](packages/fsm-viewer) | Browser viewer: draws a process, follows its active state stack, reports clicks on states and events. | [npm](https://www.npmjs.com/package/@statewalker/fsm-viewer) |

```
packages/
  fsm            (no deps)  <---------+
  fsm-charts     (no deps)  <------+  |
  fsm-viewer     ------------------+--+   depends on fsm-charts and fsm
  fsm-validator  (no deps)
```

All four are public. Package sources live in `packages/*/src`, tests in
`packages/*/test`. Each package builds with tsdown to `dist/` and publishes both `dist/`
and `src/`.

## How to run it

Requirements: Node.js 24 and pnpm 10 through corepack. The pnpm version is pinned in the
root `package.json` (`packageManager`).

1. `corepack enable`
2. `pnpm install`
3. `pnpm build` - builds every package. `fsm`, `fsm-validator` and `fsm-charts` run their
   tests before bundling, so a failing test fails the build.
4. `pnpm test` - runs vitest in every package.
5. `pnpm lint:check` and `pnpm format:check` - the same Biome checks CI runs.

One package only: `pnpm --filter @statewalker/fsm test`.

## Why it is the way it is

- **The packages share a repository but not a runtime.** `fsm`, `fsm-validator` and
  `fsm-charts` each define the configuration shape they need instead of importing it, so
  validating or drawing a configuration does not pull in the runtime. Only `fsm-viewer`,
  which drives a live process, depends on `fsm`.
- **`turbo.json` is a nested config** (`extends: ["//"]`). It is meant to be composed into
  a larger workspace that has a root `turbo.json`. Standalone, the root scripts use
  `pnpm -r` instead of turbo.
- **Biome skips vendored code.** `biome.json` excludes `packages/fsm-charts/src/dagre`,
  `src/graphlib` and `src/lodash-es` (vendored JavaScript) and the HTML test fixtures.
  `fsm-charts` and `fsm-viewer` also keep their own `eslint` scripts.

## What will surprise you

- **`turbo run build` fails in a standalone clone.** Turbo has no root config to extend:

  ```
  x Failed to parse turbo.json.
  `->   x Found an unknown key `extends`.
  ```

  Use `pnpm build`.
- **`pnpm typecheck` does nothing locally.** It runs `pnpm -r run typecheck`, and no
  package defines a `typecheck` script.
- **Subpath imports fail.** `fsm-charts` and `fsm-validator` export only the package
  root. See the package READMEs for the exact errors.

## Releases

Packages are published to npm from CI with changesets: a job opens a "chore: version
packages" pull request for packages whose packed contents differ from npm, and merging it
publishes them. This repository does not have the changesets setup yet (no `.changeset/`
directory and no `@changesets/cli` dependency), so `pnpm changeset` does not work here.

## Reference

### Commands

| Command | What it runs |
| --- | --- |
| `pnpm build` | `pnpm -r run build` |
| `pnpm test` | `pnpm -r run test` (vitest) |
| `pnpm typecheck` | `pnpm -r run typecheck` (no package defines it yet) |
| `pnpm lint` | `biome check --write .` |
| `pnpm lint:check` | `biome check .` |
| `pnpm format` | `biome format --write .` |
| `pnpm format:check` | `biome format .` |

### CI

`.github/workflows/ci.yml` calls a shared reusable workflow that runs: frozen install,
dependency-reference checks, lint, format, build, typecheck, test, and export,
dist-import and pack checks.

### Files

| Path | Purpose |
| --- | --- |
| `pnpm-workspace.yaml` | Workspace globs (`packages/*`, `apps/*`) and the dependency catalog |
| `biome.json` | Lint and format config for the whole repository |
| `turbo.json` | Nested turbo config, used only inside a larger workspace |
| `packages/fsm-validator/agent-rules/` | Rule specification and AI agent instructions (Markdown and JSON) |
| `LICENSE` | MIT |
