# @statewalker/fsm-charts: Visualization of Hierarchical Finite State Machines

Turns an HFSM configuration into a **statechart** — laid out, drawn as SVG, styled, and
linked back to a running process so the live state stack can be highlighted.

It is the rendering half of [`@statewalker/fsm`](../fsm): `fsm` runs the machine,
`fsm-charts` draws it. [`@statewalker/fsm-viewer`](../fsm-viewer) wraps this package
into a ready-made interactive viewer.

## Install

```sh
npm install @statewalker/fsm-charts
```

## What you get

The package exports five areas, each also reachable as its own entry point:

| Area | Purpose |
| --- | --- |
| `config` | Read and write HFSM configurations — serialize a process config, split and join transition strings, normalize state configs. |
| `layout` | Compute chart geometry with [dagre](https://github.com/dagrejs/dagre): nested and flattened charts, graph parameters, label dimensions. |
| `html` | Render the laid-out chart — SVG statecharts, the styles and CSS that go with them, and a panel wrapper. |
| `dom` | Build the surrounding document structure: sections, description panels, per-state descriptions, tree builders. |
| `runtime` | Bind a chart to a live process — `RuntimeStatechartApi` and `StateChartIndex` map the machine's active states onto the drawn elements. |

```js
import { buildStatechartSvg, buildStatechartCss } from "@statewalker/fsm-charts";
```

Sub-path imports are available where you only need one area, which keeps the dagre
layout code out of bundles that only render:

```js
import { buildCharts } from "@statewalker/fsm-charts/layout";
```

## Direction of dependency

`fsm-charts` depends on `@statewalker/fsm` for the configuration and process types it
draws. Nothing in `fsm` depends on this package — visualization is strictly optional.

## License

MIT.
