# @statewalker/fsm-charts

Turns a hierarchical state machine (HFSM) configuration into a statechart. It lays the
chart out (with a bundled copy of dagre), writes it as SVG/HTML strings, generates the
CSS, and provides a runtime API that highlights states and transitions on the rendered
chart. It draws configurations in the format used by [`@statewalker/fsm`](../fsm)
(`{ key, transitions, states }`) but does not depend on that package.
[`@statewalker/fsm-viewer`](../fsm-viewer) wraps it into a ready-made browser viewer.

## Install

```sh
pnpm add @statewalker/fsm-charts lodash-es
```

The package has no runtime dependencies, but the layout functions need a lodash object
passed in as the `lodash` option (`lodash` or `lodash-es`; the host chooses which build
ends up in the bundle).

## Entry points

The only exported entry point is the package root, `@statewalker/fsm-charts`
(`dist/index.js` with `.d.ts` types; sources are published in `src/`). It is ESM only.

The build also emits `dist/index-config.js`, `index-layout.js`, `index-html.js`,
`index-dom.js` and `index-runtime.js`, but `package.json` `exports` does not expose
them, so subpath imports such as `@statewalker/fsm-charts/layout` do not resolve.

Environments: the `config`, `layout` and `html` functions are plain string and object
code and run anywhere, including Node.js. The `dom` helpers and `RuntimeStatechartApi`
work on DOM elements and need a browser (or a DOM implementation such as jsdom).

## Usage

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

## API overview

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

## License

MIT.
