# StateWalker FSM

Hierarchical finite state machines for TypeScript — the runtime, a config validator,
a statechart layout/rendering library, and an interactive viewer.

Each package is published independently to npm and can be used on its own; they live
together because they are released together.

## Packages

| Package | What it does |
| --- | --- |
| [`@statewalker/fsm`](packages/fsm) | The HFSM runtime. Zero dependencies. Declare a tree of nested states and event-driven transitions, attach behaviour per state, and dump/restore a running process. |
| [`@statewalker/fsm-validator`](packages/fsm-validator) | Validates HFSM configurations before you run them — unreachable states, dangling transitions, malformed keys — and reports them in full or compact form. Zero dependencies. |
| [`@statewalker/fsm-charts`](packages/fsm-charts) | Turns an HFSM configuration into a statechart: graph layout (dagre), SVG rendering, CSS generation, and a runtime index that maps live process state onto the drawn chart. |
| [`@statewalker/fsm-viewer`](packages/fsm-viewer) | Interactive process viewer built on `fsm-charts` — renders a process, highlights the active state stack as it runs, and reports clicks on states and events. |

Dependency direction is one-way: `fsm-viewer` → `fsm-charts` → `fsm`, and
`fsm-validator` stands alone.

## Getting started

```sh
pnpm install
pnpm build      # turbo run build
pnpm test       # turbo run test
```

Inside a package:

```sh
pnpm --filter @statewalker/fsm test
```

## Repository history

This monorepo was assembled from four separate repositories. Every package kept its
own commit history through the move, and each original repository is additionally
preserved intact as a branch:

| Branch | Original repository |
| --- | --- |
| `history/statewalker-fsm-charts` | `statewalker/statewalker-fsm-charts` |
| `history/statewalker-fsm-validator` | `statewalker/statewalker-fsm-validator` |
| `history/statewalker-fsm-viewer` | `statewalker/statewalker-fsm-viewer` |
| `history/statewalker-fsm-process` | `statewalker/statewalker-fsm-process` |

`statewalker-fsm-process` is history only — the package itself was retired and is not
part of this monorepo. Its last published release remains `@statewalker/fsm-process@0.17.2`.

## Working inside an umbrella

`turbo.json` here is a **nested** config (`extends: ["//"]`) and `biome.json` sets
`root: false`, so this repository composes into a StateWalker umbrella workspace. Both
settings are required there and prevent `turbo run build` from running against this
repository on its own — use `pnpm -r build` for a standalone build.

## Cross-repo dependencies

**This repository depends on no other repository.** It is a foundation of the
StateWalker dependency graph — everything below it may be built without it.

Cross-repo dependencies are declared `workspace:*` rather than `catalog:`. This is
deliberate: turbo derives its task graph from `workspace:` specifiers and does **not**
resolve `catalog:`, so a `catalog:` cross-repo dependency is invisible to the scheduler
and its consumer can be built before it.

## License

MIT.
