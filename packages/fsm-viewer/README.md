# @statewalker/fsm-viewer

Browser viewer for [`@statewalker/fsm`](../fsm) processes. It draws a process
configuration as an interactive statechart, highlights the active state stack as the
machine runs, and reports clicks on states and transitions. It builds on
[`@statewalker/fsm-charts`](../fsm-charts), which does the layout and SVG rendering.

## Install

```sh
pnpm add @statewalker/fsm-viewer lodash-es
```

`@statewalker/fsm` and `@statewalker/fsm-charts` are runtime dependencies and are
installed with it. The layout code needs a lodash object passed in as the `lodash`
option; it is not a dependency, so the host decides which build (`lodash` or
`lodash-es`) ends up in the bundle.

## Entry point

One entry point, `@statewalker/fsm-viewer` (`dist/index.js` with `.d.ts` types; sources
are published in `src/`). ESM only. It creates DOM elements, so it needs a browser (or a
DOM implementation such as jsdom).

## Usage

`newProcessCharts` returns a `<div>` with a `selectState` method. Call it with a stack of
state keys and the chart highlights that path; it returns a function that clears the
highlight.

```js
import * as lodash from "lodash-es";
import { newProcessCharts } from "@statewalker/fsm-viewer";

const chart = newProcessCharts({
  config, // the HFSM configuration to draw
  direction: "lr", // "tb" | "bt" | "lr" | "rl"; default "lr"
  lodash,
  onStateClick: (statesStack) => console.log("state", statesStack),
  onEventClick: (edge) => console.log("event", edge),
});

document.body.append(chart);

const reset = chart.selectState(["Player", "Active", "Playing"]);
```

`renderStateCharts` binds the chart to a running `FsmProcess`: the highlight follows the
process, and clicking a transition dispatches its event when it is enabled.

```js
import * as lodash from "lodash-es";
import { FsmProcess } from "@statewalker/fsm";
import { renderStateCharts } from "@statewalker/fsm-viewer";

const process = new FsmProcess(config);
document.body.append(renderStateCharts({ process, lodash }));
await process.dispatch("");
```

Both functions also take `renderer` (returns a DOM node with a description for a state
stack, shown in the state's panel) and `invalidation` (a promise; when it resolves, the
click listeners are removed).

## Exports

| Export | Purpose |
| --- | --- |
| `newProcessCharts(options)` | Build the interactive chart for a configuration. Returns the element with `selectState(stack)`. |
| `renderStateCharts(options)` | Same chart, bound to a live `FsmProcess` (`options.process`). Default direction `"tb"`. |
| `renderStateDescription({ process, renderer })` | Returns a `<div>` that shows `renderer(stack)` for the current state and replaces it on every transition. |
| `prepareStateDescriptions({ element, rootStateKey, titleElementName })` | Read per-state descriptions from a document section (see `getStatesDescriptions` in `fsm-charts`) and return a `renderer` for the functions above. |
| `renderCss(rootSelector = ":root")` | Returns a `<style>` element with the chart styles scoped to `rootSelector`. |
| `newId(prefix)` | Shared id generator, so ids stay unique across charts on one page. |
| `FsmStateChartsConfig` | Type of the configuration accepted by `newProcessCharts`. |

## Development

```sh
pnpm --filter @statewalker/fsm-viewer test
pnpm --filter @statewalker/fsm-viewer dev   # Observable Framework preview of src/docs
```

## License

MIT.
