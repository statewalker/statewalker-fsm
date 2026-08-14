import {
  buildCharts,
  getGraphParamsProvider,
  buildStatechartsPanel,
  RuntimeStatechartApi,
  StateChartIndex,
  type StateGraphNode,
  type StateGraphEdge,
} from "@statewalker/fsm-charts";
import { newId } from "./idGenerator.js";
import { renderCss } from "./renderCss.js";

export type FsmStateChartsConfig = {
  key: string;
  transitions?: [from: string, event: string, to: string][];
  states?: FsmStateChartsConfig[];
} & Record<string, unknown>;

export function newProcessCharts({
  config,
  direction = "lr",
  onStateClick,
  // onTransitionClick,
  onEventClick,
  renderer,
  invalidation,
  lodash,
}: {
  direction?: "tb" | "bt" | "lr" | "rl";
  config: FsmStateChartsConfig;
  onStateClick?: (statesStack: StateGraphNode[]) => void;
  onEventClick?: (edge: StateGraphEdge) => void;
  renderer?: (statesStack: StateGraphNode[]) => undefined | Node;
  invalidation?: Promise<void>;
  lodash: unknown;
}): HTMLElement & { selectState: (stack: string[]) => () => void } {
  // ====================================================
  // Stage 1: create a static statechart index

  const fontSize = 12;
  const transitionsFontSize = 6;
  const statechart = buildCharts({
    lodash,
    newId,
    config,
    direction,
    padding: [fontSize, fontSize],
    ...getGraphParamsProvider({
      // fontSize,
      stateFontSize: fontSize,
      stateTextPadding: fontSize,
      transitionsFontSize,
      transitionsTextPadding: [
        transitionsFontSize * 1.6,
        transitionsFontSize * 2,
      ],
    }),
  });

  // ====================================================
  // Stage 2: build DOM/SVG/CSS elements
  // to visualize interactive charts in the browser

  const chartId = newId("statechart");
  const lines: string[] = [];
  buildStatechartsPanel({
    statechart,
    newId,
    println: (str: string) => lines.push(str),
  });
  const html = lines.join("\n");

  const element = document.createElement("div");
  element.setAttribute("id", chartId);
  element.innerHTML = `${html}`;

  const css = renderCss(`#${chartId}`);
  element.appendChild(css);

  const api = new RuntimeStatechartApi({
    element,
    statechart,
  });
  const chartsIndex = new StateChartIndex({ statechart });
  if (renderer) {
    const allNodes = chartsIndex.getStateNodes();
    for (const node of allNodes) {
      const stack = chartsIndex.getStackByStateId(node.id);
      const description = renderer(stack);
      api.setStateDescription(node.id, description);
    }
  }

  function selectState(stack: string[]) {
    const idsStack = chartsIndex.getStatesIds(...stack);
    const eventsIndex: Record<string, boolean> = {};
    api.deselectTransitions("active");
    api.deselectStates("active");
    api.closeStatePanels();
    for (let i = idsStack.length - 1; i >= 0; i--) {
      const stateId = idsStack[i];
      api.selectState(stateId, "active");
      api.openStatePanel(stateId);
      const transitions = chartsIndex.getTransitions(stateId);
      transitions.forEach((t) => {
        if (!eventsIndex[t.event]) {
          if (t.to !== "<final>") {
            eventsIndex[t.event] = true;
          }
          api.selectTransition(t.id, "active");
        }
      });
    }
    // api.focusStates(...idsStack);
    return () => {
      api.deselectTransitions("active");
      api.deselectStates("active");
      api.closeStatePanels();
    };
  }

  const unregisterStateListeners = api.onStateClick((stateId: string) => {
    const nodes = chartsIndex.getStackByStateId(stateId);
    const nodeIds = nodes.map((n) => n.id);
    const selected = api.isStateSelected(stateId, "selected");
    api.deselectTransitions("selected");
    api.deselectStates("selected");
    api.closeStatePanels();
    for (let i = 0; i < nodeIds.length; i++) {
      const id = nodeIds[i];
      api.openStatePanel(id);
      api.selectState(id, "selected");
      // const transitions = chartsIndex.getTransitions(id);
      // transitions.forEach((t) => api.selectTransition(t.id, "selected"));
    }
    if (selected) {
      api.deselectState(stateId, "selected");
      api.closeStatePanel(stateId);
      // const transitions = chartsIndex.getTransitions(stateId);
      // transitions.forEach((t) => api.deselectTransition(t.id, "selected"));
    } else {
      api.openStatePanel(stateId);
    }
    if (onStateClick) {
      onStateClick(nodes);
    }
  });

  // const unregisterTransitionsListeners = api.onTransitionClick(
  //   (transitionId) => {
  //     // api.toggleTransition(transitionId);
  //     console.log(">> transition", transitionId);
  //   }
  // );
  invalidation && invalidation.then(unregisterStateListeners);
  // invalidation.then(unregisterTransitionsListeners);

  if (onEventClick) {
    const unregisterClickListener = api.onTransitionClick(
      (transitionId: string) => {
        const edge = chartsIndex.getEdgeById(transitionId);
        edge && onEventClick(edge);
      },
    );
    invalidation &&
      unregisterClickListener &&
      invalidation.then(unregisterClickListener);
  }
  // initRuntimeApi({ statechart, element: element });
  return Object.assign(element, { selectState });
}
