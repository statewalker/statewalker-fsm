# @statewalker/fsm-charts

## What it is: statechart layout and rendering for HFSM configurations

Turns a hierarchical state machine (HFSM) configuration (`{ key, transitions, states }`,
the format `@statewalker/fsm` runs) into a statechart. It lays the chart out with a
vendored copy of dagre, writes SVG/HTML and CSS as strings, and provides a runtime API
that highlights states and transitions on the rendered chart. `@statewalker/fsm-viewer`
builds a ready-made browser viewer on top of it.

## Why it exists: a nested state machine is hard to read as JSON

A configuration with several levels of nested states and wildcard transitions is hard to
follow as text. This package draws each composite state as its own chart, nested the same
way the states are, so the structure and the transitions out of every state are visible.
It works from the configuration alone and does not import `@statewalker/fsm`, so drawing
a machine does not require running it.

## How to use: lay out, render to strings, then bind to the DOM

```sh
pnpm add @statewalker/fsm-charts lodash-es
```

The package has no runtime dependencies, but the layout functions need a lodash object
passed in as the `lodash` option. Either `lodash` or `lodash-es` works.

```
FsmStateConfig --buildCharts--> StateChart --buildStatechartsPanel--> HTML + SVG strings
                                    |        --buildStatechartCss-----> CSS string
                                    |
                                    +--> StateChartIndex (key <-> id lookups)
                                    +--> RuntimeStatechartApi (highlight, panels, clicks on the DOM)
```

The only entry point is the package root, `@statewalker/fsm-charts` (`dist/index.js` with
`.d.ts` types; sources are published in `src/`). It is ESM only.

The `config`, `layout` and `html` functions produce plain strings and objects and run
anywhere, including Node.js. The `dom` helpers and `RuntimeStatechartApi` work on DOM
elements and need a browser or a DOM implementation such as jsdom.

### What each export is for

**Config**

- `serializeProcessConfig(config)` - format a configuration as JSON text with one
  transition per line.
- `splitTransitionString(str)` - parse a chain such as `"Idle -play-> Active -stop-> Idle"`
  into `[from, event, to]` tuples; `concatTransitionsToString(transitions)` does the
  reverse.
- `toFsmStateConfig(json)` - normalize a loosely written configuration (transitions as
  strings or arrays, duplicates removed) into an `FsmStateConfig`.

**Layout**

- `buildCharts({ lodash, config, newId, ...graphParams })` - lay out the whole state
  tree. Returns a `StateChart` (nested charts with nodes, edges, sizes). Options:
  `direction`, `vertical`, `padding`, `getStateLabel`, `initialStateKey`
  (default `"<initial>"`), `finalStateKey` (default `"<final>"`).
- `buildFlatCharts(...)` - lay out one flat transition graph (a `TransitionsGraph`).
- `getGraphParamsProvider({ fontSize, stateFontSize, stateTextPadding, transitionsFontSize, transitionsTextPadding, ... })`
  - default `getStateParams` / `getTransitionParams` functions that size nodes and
  edges from their labels.
- `getLabelDimensions(label, options)` - estimate label size from font size and
  character width.

**HTML and CSS**

- `buildStatechartsPanel({ statechart, newId, println })` - write nested `<details>`
  panels, one per composite state, each with its SVG chart.
- `buildStatechartSvg({ graph, newId, println, ... })` - write the SVG of one chart.
- `buildStatechartCss({ prefix })` - the stylesheet for the charts, scoped to `prefix`
  (default `:root`). `buildStatechartStyles`, `buildStatechartStylesWithModifier`,
  `buildStateDetailsStyle`, `buildStateDetailsStyleWithModifier` and the
  `activeStatesStyle` / `activeTransitionsStyle` / `selectedStatesStyle` /
  `selectedTransitionsStyle` objects are its building blocks.
- `serializeCss(tree)` and `toKebabCase(str)` - CSS helpers.

**DOM** (browser)

- `buildSections`, `visitSectionNodes`, `vistSections`, `findSection`, `visitDom`,
  `toDomNodesIterator`, `isDomElement` - split a document into sections by headings.
- `getStatesDescriptions({ element, rootStateKey })`, `visitStateDescriptions` - read
  per-state descriptions from a document section whose heading matches the root state.
- `getStateDescriptionRenderer`, `renderSections`, `newTreeBuilder` - helpers to render
  those descriptions.

**Runtime**

- `StateChartIndex({ statechart })` - lookups over a built chart: `getStatesIds(...keys)`,
  `getStackByStateId(id)`, `getTransitions(stateId)`, `getEdgeById(id)`,
  `getStateNodes()` and more.
- `RuntimeStatechartApi({ element, statechart })` - acts on the rendered chart:
  `selectState` / `deselectState(s)`, `selectTransition` / `deselectTransition(s)`
  with a modifier (`"selected"` by default, `"active"` for the running state),
  `openStatePanel` / `closeStatePanel(s)`, `setStateDescription`, `onStateClick`,
  `onTransitionClick`, `close()`.

Types such as `StateChart`, `StateGraphNode`, `StateGraphEdge`, `FsmStateConfig` and
`GraphParamsProvider` are exported as well.

## Examples

### Draw a configuration and highlight a state

```js
import * as lodash from "lodash-es";
import {
  buildCharts,
  buildStatechartCss,
  buildStatechartsPanel,
  getGraphParamsProvider,
  RuntimeStatechartApi,
  StateChartIndex,
} from "@statewalker/fsm-charts";

let counter = 0;
const newId = (prefix) => `${prefix}-${++counter}`;

const config = {
  key: "Player",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
  ],
  states: [
    { key: "Idle" },
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
      ],
    },
  ],
};

// 1. Layout: nested charts with node and edge geometry.
const statechart = buildCharts({
  lodash,
  config,
  newId,
  direction: "lr", // "tb" | "bt" | "lr" | "rl"
  ...getGraphParamsProvider({ fontSize: 12 }),
});

// 2. Render: HTML (nested <details> panels with SVG charts) and CSS.
const lines = [];
buildStatechartsPanel({ statechart, newId, println: (line) => lines.push(line) });
const element = document.createElement("div");
element.id = "chart";
element.innerHTML = lines.join("\n");
const style = document.createElement("style");
style.textContent = buildStatechartCss({ prefix: "#chart" });
element.append(style);
document.body.append(element);

// 3. Runtime: map state keys to chart ids and highlight them.
const index = new StateChartIndex({ statechart });
const api = new RuntimeStatechartApi({ element, statechart });
for (const id of index.getStatesIds("Player", "Active", "Playing")) {
  api.selectState(id, "active");
  api.openStatePanel(id);
}
api.onStateClick((stateId) => console.log(index.getStackByStateId(stateId)));
```

### Print a configuration compactly

```js
import { serializeProcessConfig, splitTransitionString } from "@statewalker/fsm-charts";

console.log(serializeProcessConfig(config)); // JSON text, one transition per line
console.log(splitTransitionString("Idle -play-> Active -stop-> Idle"));
// [["Idle", "play", "Active"], ["Active", "stop", "Idle"]]
```

## Internals: vendored layout, injected lodash

- **Layout.** `buildCharts` walks the state tree and lays out each composite state as a
  separate flat graph with `buildFlatCharts`, which uses the vendored dagre and graphlib
  sources in `src/dagre` and `src/graphlib`. Pseudo-states are drawn as `"<initial>"` and
  `"<final>"` nodes; both keys can be changed with `initialStateKey` / `finalStateKey`.
- **Rendering is string output.** `buildStatechartsPanel` and `buildStatechartSvg` write
  lines through a `println` callback instead of creating DOM nodes, so the same code
  renders in a browser, in Node.js, or into a file.
- **Styling is by CSS variables and modifiers.** `buildStatechartCss` emits rules for the
  `selected` and `active` modifiers that `RuntimeStatechartApi` toggles, scoped to a
  `prefix` selector so several charts can share a page.
- **lodash is injected.** The vendored dagre code calls lodash through a module-level
  holder that `buildFlatCharts` sets from the `lodash` option, so the host decides which
  lodash build ends up in its bundle. Without it, layout fails with
  `TypeError: Cannot read properties of undefined (reading 'has')`.
- **Entry points by area.** Besides the package root (everything), each area is its own
  entry: `@statewalker/fsm-charts/config`, `/layout`, `/html`, `/dom` and `/runtime`. Layout
  and HTML generation import no DOM code, so a Node.js or worker build can take
  `/layout` and `/html` alone.
- **Dependencies.** Zero runtime dependencies. dagre and graphlib are vendored; lodash
  comes from the caller.

## License

MIT.
