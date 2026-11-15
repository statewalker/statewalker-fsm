import type { FsmAnyProcess } from "@statewalker/fsm";
import { getStateTransitions } from "@statewalker/fsm";
import type { StateGraphEdge, StateGraphNode } from "@statewalker/fsm-charts";
import { _addStateRenderer } from "./_addStateRenderer.js";
import { newProcessCharts } from "./newProcessCharts.js";

/**
 * The interactive statechart of `newProcessCharts`, bound to a live process (either
 * `FsmProcess` or `FsmProcessSync`): the highlight follows the active state stack,
 * and clicking a transition dispatches its event when it is one of the transitions
 * the engine reports as enabled in the current state (`getStateTransitions`).
 * `dispose()` on the returned element (or `invalidation`) releases the listeners
 * and the process subscription.
 */
export function renderStateCharts({
  process,
  direction = "tb",
  lodash,
  onStateClick,
  onEventClick,
  renderer,
  invalidation,
}: {
  process: FsmAnyProcess;
  direction?: "tb" | "bt" | "lr" | "rl";
  lodash: unknown;
  onStateClick?: (statesStack: StateGraphNode[]) => void;
  onEventClick?: (edge: StateGraphEdge) => void;
  renderer?: (statesStack: string[]) => undefined | Node;
  invalidation?: Promise<void>;
}) {
  const charts = newProcessCharts({
    config: process.config,
    renderer,
    onStateClick,
    onEventClick: (edge) => {
      const stack: string[] = [];
      for (let s = process.state; s; s = s.parent) stack.unshift(s.key);
      const enabled = charts.getTransitionEdges(stack, getStateTransitions(process.state));
      if (enabled.some((e) => e.id === edge.id)) {
        process.dispatch(edge.event);
      }
      if (onEventClick) {
        onEventClick(edge);
      }
    },
    direction: direction || "tb",
    lodash,
    invalidation,
  });
  // Capture the onStateCreate subscription so it can be torn down with the chart.
  // `process.state` is the state being entered when the renderer is called.
  const disposeRenderer = _addStateRenderer(process, (stack) => {
    return charts.selectState(stack, getStateTransitions(process.state));
  });
  const disposeCharts = charts.dispose;
  function dispose() {
    disposeRenderer?.();
    disposeCharts();
  }
  invalidation?.then(dispose);
  return Object.assign(charts, { dispose });
}
