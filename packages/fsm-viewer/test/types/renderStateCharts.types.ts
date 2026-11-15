// Type-level test (#30): a process created from `@statewalker/fsm` is accepted by the
// viewer's published types. Compiled by the package's `typecheck` (after `pnpm build`), never executed.
import { FsmProcess, FsmProcessSync } from "@statewalker/fsm";
import {
  newProcessCharts,
  prepareStateDescriptions,
  renderStateCharts,
} from "@statewalker/fsm-viewer";
import * as lodash from "lodash-es";

const config = { key: "App", transitions: [["", "*", "A"]] as [string, string, string][] };

const charts: HTMLElement & { dispose: () => void } = renderStateCharts({
  process: new FsmProcess(config),
  lodash,
});
charts.dispose();
renderStateCharts({ process: new FsmProcessSync(config), lodash });

// The renderer returned by prepareStateDescriptions plugs into the chart functions (#39).
const renderer = prepareStateDescriptions({ element: document.body, rootStateKey: "App" });
newProcessCharts({ config, lodash, renderer }).selectState(["App", "A"]);
