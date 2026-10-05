# StateWalker FSM

Hierarchical finite state machines (HFSM) for TypeScript: the runtime, a configuration
validator, a statechart layout and rendering library, and an interactive viewer.

Each package is published to npm on its own and can be used without the others.

## Packages

| Package | Description | npm |
| --- | --- | --- |
| [`@statewalker/fsm`](packages/fsm) | HFSM runtime. Nested states, event-driven transitions, per-state behaviour, dump/restore of a running process. No runtime dependencies. | [npm](https://www.npmjs.com/package/@statewalker/fsm) |
| [`@statewalker/fsm-validator`](packages/fsm-validator) | Checks HFSM configurations against 25 lexical, structural and semantic rules and formats the results as reports. Also ships prompt texts for AI agents that write HFSM configs. No runtime dependencies. | [npm](https://www.npmjs.com/package/@statewalker/fsm-validator) |
| [`@statewalker/fsm-charts`](packages/fsm-charts) | Turns an HFSM configuration into a statechart: layout (bundled dagre), SVG and CSS generation, and a runtime API that highlights states on the rendered chart. | [npm](https://www.npmjs.com/package/@statewalker/fsm-charts) |
| [`@statewalker/fsm-viewer`](packages/fsm-viewer) | Browser viewer built on `fsm-charts`: draws a process, highlights the active state stack as it runs, reports clicks on states and events. | [npm](https://www.npmjs.com/package/@statewalker/fsm-viewer) |

All packages are public. Inside the repository, `fsm-viewer` depends on `fsm` and
`fsm-charts`. `fsm`, `fsm-charts` and `fsm-validator` have no `@statewalker`
dependencies; `fsm-charts` and `fsm-validator` define their own configuration type.

## Relation to other StateWalker repositories

This repository consumes no packages from other StateWalker repositories. Other
repositories build on it; for example, `statewalker-ai` and `sandclaw` depend on
`@statewalker/fsm`.

## Requirements

- Node.js 24
- pnpm 10 through corepack (`corepack enable`; the version is pinned in the root
  `package.json` `packageManager` field)

## Development

```sh
corepack enable
pnpm install
pnpm build        # pnpm -r run build (fsm, fsm-charts, fsm-validator run their tests first)
pnpm test         # pnpm -r run test (vitest)
pnpm typecheck    # pnpm -r run typecheck
pnpm lint         # biome check --write .
pnpm lint:check   # biome check .
pnpm format       # biome format --write .
pnpm format:check # biome format .
```

Run a script in one package:

```sh
pnpm --filter @statewalker/fsm test
```

`turbo.json` is a nested config (`extends: ["//"]`) for use inside a StateWalker
umbrella workspace. In a standalone clone, use the pnpm scripts above.

CI runs the shared workflow from
[statewalker/.github](https://github.com/statewalker/.github): frozen install,
dependency-reference checks, lint, format, build, typecheck, test, and export, dist-import
and pack checks.

## Releases

Releases are automated with changesets. After CI passes on `main`, a job adds a
changeset for every package whose packed contents differ from the version on npm and
opens a "chore: version packages" pull request. Merging that pull request publishes the
packages to npm with provenance. To choose the bump level or the changelog text
yourself, add a changeset to your pull request with `pnpm changeset`. Renovate keeps
dependencies up to date.

See the [statewalker/.github README](https://github.com/statewalker/.github#readme) for
details.

## Repository history

This monorepo was assembled from four repositories, now archived on GitHub:
`statewalker/statewalker-fsm-charts`, `statewalker/statewalker-fsm-validator`,
`statewalker/statewalker-fsm-viewer` and `statewalker/statewalker-fsm-process`. The
packages kept their commit history on `main`.

`statewalker-fsm-process` is history only: the package was retired, and its last
release is `@statewalker/fsm-process@0.17.2`. Its history is kept in the
`history/statewalker-fsm-process` branch.

## License

MIT. See [LICENSE](LICENSE).
