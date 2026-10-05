# @statewalker/fsm-viewer

## What it is: an interactive statechart for a running process

A browser viewer for `@statewalker/fsm` processes. It draws a process configuration as an
interactive statechart, highlights the active state stack as the machine runs, and
reports clicks on states and transitions. Layout and SVG rendering come from
`@statewalker/fsm-charts`.

## Why it exists: watching a machine run is the fastest way to debug it

`@statewalker/fsm-charts` produces strings and low-level DOM bindings; turning them into
something you can drop on a page takes layout parameters, CSS scoping, id generation and
event wiring. This package does that once. `renderStateCharts` also follows a live
`FsmProcess`, so you can see which states are active and fire transitions by clicking
them while you develop a machine.

## How to use: give it a configuration or a process, append the element

```sh
pnpm add @statewalker/fsm-viewer lodash-es
```

`@statewalker/fsm` and `@statewalker/fsm-charts` are runtime dependencies and are
installed with it. The layout code needs a lodash object passed in as the `lodash`
option. lodash is not a dependency, so the host decides which build (`lodash` or
`lodash-es`) ends up in the bundle.

One entry point, `@statewalker/fsm-viewer` (`dist/index.js` with `.d.ts` types; sources
are published in `src/`). ESM only. It creates DOM elements, so it needs a browser or a
DOM implementation such as jsdom.

| Export | Purpose |
| --- | --- |
| `newProcessCharts(options)` | Build the interactive chart for a configuration. Returns the element with `selectState(stack)`. Default direction `"lr"`. |
| `renderStateCharts(options)` | Same chart, bound to a live `FsmProcess` (`options.process`). Default direction `"tb"`. |
| `renderStateDescription({ process, renderer })` | Returns a `<div>` that shows `renderer(stack)` for the current state and replaces it on every transition. |
| `prepareStateDescriptions({ element, rootStateKey, titleElementName })` | Read per-state descriptions from a document section whose headings are written `[StateKey] Title` and return a `renderer` for the functions above. |
| `renderCss(rootSelector = ":root")` | Returns a `<style>` element with the chart styles scoped to `rootSelector`. |
| `newId(prefix)` | Shared id generator (`prefix_1`, `prefix_2`, ...), so ids stay unique across charts on one page. |
| `FsmStateChartsConfig` | Type of the configuration accepted by `newProcessCharts`. |

`newProcessCharts` and `renderStateCharts` also take `onStateClick(statesStack)`,
`onEventClick(edge)`, `renderer` (returns a DOM node with a description for a state
stack, shown in that state's panel) and `invalidation` (a promise; when it resolves, the
click listeners are removed).

## Examples

### Draw a configuration and highlight a path

`selectState` takes a stack of state keys and returns a function that clears the
highlight.

```js
import * as lodash from "lodash-es";
import { newProcessCharts } from "@statewalker/fsm-viewer";

const chart = newProcessCharts({
  config, // the HFSM configuration to draw
  direction: "lr", // "tb" | "bt" | "lr" | "rl"
  lodash,
  onStateClick: (statesStack) => console.log("state", statesStack),
  onEventClick: (edge) => console.log("event", edge),
});
document.body.append(chart);

const reset = chart.selectState(["Player", "Active", "Playing"]);
```

### Follow a running process

The highlight follows the process. Clicking a transition dispatches its event when
`isStateTransitionEnabled(process, event)` allows it.

```js
import * as lodash from "lodash-es";
import { FsmProcess } from "@statewalker/fsm";
import { renderStateCharts } from "@statewalker/fsm-viewer";

const process = new FsmProcess(config);
document.body.append(renderStateCharts({ process, lodash }));
await process.dispatch("");
```

### Show a description of the current state

```js
import { prepareStateDescriptions, renderStateDescription } from "@statewalker/fsm-viewer";

// <section id="docs">
//   <h2>[Player] Media player</h2>
//   <h3>[Idle] Waiting</h3><p>Nothing plays until "play".</p>
//   <h3>[Active] Playing or paused</h3><p>...</p>
// </section>
// The description nodes are removed from the section and shown by the renderer.
const renderer = prepareStateDescriptions({
  element: document.querySelector("#docs"),
  rootStateKey: "Player",
});
document.body.append(renderStateDescription({ process, renderer }));
```

## Internals: a thin layer over fsm-charts

- **Building the chart.** `newProcessCharts` calls `buildCharts` with fixed font sizes
  (12 for states, 6 for transitions), renders the panel HTML into a `<div>` with a fresh
  id, appends `renderCss("#<id>")`, and wires a `RuntimeStatechartApi` and
  `StateChartIndex` to it.
- **Two highlight modifiers.** `selectState` marks the active stack and its outgoing
  transitions with the `active` modifier and opens their panels. A click on a state marks
  the clicked stack with `selected`, so a user's selection and the running state do not
  overwrite each other.
- **Following a process.** `renderStateCharts` and `renderStateDescription` register an
  `onStateCreate` handler on the process and update on every state entry; the cleanup
  runs on that state's exit.
- **Constraint: listeners stay until `invalidation` resolves.** Without an
  `invalidation` promise, the click listeners and the process subscription of
  `newProcessCharts` / `renderStateCharts` are never removed, even after the element
  leaves the page. `renderStateDescription` takes no `invalidation` and never
  unsubscribes from the process.
- **Constraint: headings are read with `innerText`.** `prepareStateDescriptions` reads
  heading text through `HTMLElement.innerText`, which jsdom does not implement. Under jsdom
  it throws `TypeError: Cannot read properties of undefined (reading 'trim')`.
- **Dependencies.** `@statewalker/fsm` (process types and `isStateTransitionEnabled`) and
  `@statewalker/fsm-charts` (layout, rendering, runtime API). lodash is injected by the
  caller.

## Development

```sh
pnpm --filter @statewalker/fsm-viewer test
pnpm --filter @statewalker/fsm-viewer dev   # Observable Framework preview of src/docs
```

## License

MIT.
