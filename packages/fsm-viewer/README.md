# @statewalker/fsm-viewer: Viewer For FSM Processes

An interactive statechart viewer for [`@statewalker/fsm`](../fsm) processes. It renders
a process configuration as a chart, highlights the active state stack as the machine
runs, and reports clicks on states and transitions.

It is the ready-made layer on top of [`@statewalker/fsm-charts`](../fsm-charts): that
package computes layout and draws SVG, this one assembles it into something you can put
on a page and drive.

## Install

```sh
npm install @statewalker/fsm-viewer
```

`@statewalker/fsm` and `@statewalker/fsm-charts` are runtime dependencies and are
installed with it.

## Usage

`newProcessCharts` returns a DOM element with a `selectState` method — call it with the
active state stack and the chart highlights that path:

```js
import { newProcessCharts } from "@statewalker/fsm-viewer";
import lodash from "lodash-es";

const chart = newProcessCharts({
  config,                 // the HFSM configuration to draw
  direction: "lr",        // "tb" | "bt" | "lr" | "rl"
  lodash,                 // lodash is injected, not bundled
  onStateClick: (statesStack) => console.log("state", statesStack),
  onEventClick: (edge) => console.log("event", edge),
});

document.body.append(chart);

// as the process advances, highlight where it is
const reset = chart.selectState(["main", "loading"]);
```

`lodash` is a required injection rather than a dependency, so the host decides which
build (`lodash` or `lodash-es`) ends up in the bundle.

## Other exports

| Export | Purpose |
| --- | --- |
| `renderStateCharts` | Render charts for a process without the interactive wrapper. |
| `prepareStateDescriptions` | Build the per-state description model used by the panels. |
| `renderStateDescription` | Render a single state's description. |
| `renderCss` | Emit the stylesheet the charts need, scoped to a root selector (default `:root`). |
| `newId` | Shared id generator, so ids are stable across charts on one page. |

## License

MIT.
