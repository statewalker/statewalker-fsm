import type { FsmProcess } from "@statewalker/fsm";
import { isStateTransitionEnabled } from "@statewalker/fsm";
import type { StateGraphEdge, StateGraphNode } from "@statewalker/fsm-charts";
import { _addStateRenderer } from "./_addStateRenderer.js";
import { newProcessCharts } from "./newProcessCharts.js";

export function renderStateCharts({
  process,
  direction = "tb",
  lodash,
  onStateClick,
  onEventClick,
  renderer,
  invalidation,
}: {
  process: FsmProcess;
  direction?: "tb" | "bt" | "lr" | "rl";
  lodash: unknown;
  onStateClick?: (statesStack: StateGraphNode[]) => void;
  onEventClick?: (edge: StateGraphEdge) => void;
  renderer?: (statesStack: StateGraphNode[]) => undefined | Node;
  invalidation?: Promise<void>;
}) {
  const charts = newProcessCharts({
    config: process.config,
    renderer,
    onStateClick,
    onEventClick: async (edge) => {
      const { event } = edge;
      if (isStateTransitionEnabled(process, event)) {
        process.dispatch(event);
      }
      if (onEventClick) {
        onEventClick(edge);
      }
    },
    direction: direction || "tb",
    lodash,
    invalidation,
  });
  // Capture the onStateCreate subscription so it can be torn down; also thread
  // `invalidation` into newProcessCharts (above) so its click listeners unregister.
  const disposeRenderer = _addStateRenderer(process, (stack) => {
    return charts.selectState(stack);
  });
  invalidation?.then(() => disposeRenderer?.());
  return charts;
}
