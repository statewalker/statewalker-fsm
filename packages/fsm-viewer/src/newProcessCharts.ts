import {
  type FsmStateConfig,
  FsmStateDescriptor,
  type FsmStateNode,
  getStateTransitions,
  getSubstateTarget,
} from "@statewalker/fsm";
import {
  buildCharts,
  buildStatechartsPanel,
  getGraphParamsProvider,
  RuntimeStatechartApi,
  StateChartIndex,
  type StateGraphEdge,
  type StateGraphNode,
} from "@statewalker/fsm-charts";
import { newId } from "./idGenerator.js";
import { renderCss } from "./renderCss.js";

export type FsmStateChartsConfig = {
  key: string;
  transitions?: [from: string, event: string, to: string][];
  states?: FsmStateChartsConfig[];
} & Record<string, unknown>;

type FsmTransition = [from: string, event: string, to: string];

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
  // Takes a stack of state keys, as the renderer of `prepareStateDescriptions`.
  renderer?: (statesStack: string[]) => undefined | Node;
  invalidation?: Promise<void>;
  lodash: unknown;
}): HTMLElement & {
  selectState: (stack: string[], transitions?: FsmTransition[]) => () => void;
  getTransitionEdges: (stack: string[], transitions?: FsmTransition[]) => StateGraphEdge[];
  dispose: () => void;
} {
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
      transitionsTextPadding: [transitionsFontSize * 1.6, transitionsFontSize * 2],
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
    // A composite state is both a chart and a node of its parent, with one id.
    const ids = new Set(chartsIndex.getStateNodes().map((node) => node.id));
    for (const id of ids) {
      const stack = chartsIndex.getStackByStateId(id).map((node) => node.key);
      const description = renderer(stack);
      api.setStateDescription(id, description);
    }
  }

  // The engine's enabled transitions for a stack of state keys, resolved with the
  // engine's own descriptors (as a process in that stack would).
  const rootDescriptor = FsmStateDescriptor.build(config as FsmStateConfig);
  function getEnabledTransitions(stack: string[]): FsmTransition[] {
    let state: FsmStateNode | undefined;
    for (const key of stack) {
      state = state ? getSubstateTarget(state, key) : { key, descriptor: rootDescriptor };
    }
    return getStateTransitions(state);
  }

  // The edges drawn for the transitions enabled in `stack` (by default, those the
  // engine reports for it): each `[from, event, to]` is matched in the chart of
  // the level where `from` is the active state, by the state's own edge or a `"*"` one.
  function getTransitionEdges(
    stack: string[],
    transitions: FsmTransition[] = getEnabledTransitions(stack),
  ): StateGraphEdge[] {
    const idsStack = chartsIndex.getStatesIds(...stack);
    const pending = new Set(transitions);
    const edges: StateGraphEdge[] = [];
    for (let i = idsStack.length - 1; i > 0; i--) {
      for (const t of pending) {
        const [from, event, to] = t;
        if (from !== stack[i]) continue;
        const edge = chartsIndex.findTransition(idsStack[i], event, to);
        if (!edge) continue;
        edges.push(edge);
        pending.delete(t);
      }
    }
    return edges;
  }

  function selectState(stack: string[], transitions?: FsmTransition[]) {
    const idsStack = chartsIndex.getStatesIds(...stack);
    api.deselectTransitions("active");
    api.deselectStates("active");
    api.closeStatePanels();
    for (const stateId of idsStack) {
      api.selectState(stateId, "active");
      api.openStatePanel(stateId);
    }
    for (const edge of getTransitionEdges(stack, transitions)) {
      api.selectTransition(edge.id, "active");
    }
    // api.focusStates(...idsStack);
    return () => {
      api.deselectTransitions("active");
      api.deselectStates("active");
      api.closeStatePanels();
    };
  }

  api.onStateClick((stateId: string) => {
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
  // invalidation.then(unregisterTransitionsListeners);

  if (onEventClick) {
    api.onTransitionClick((transitionId: string) => {
      const edge = chartsIndex.getEdgeById(transitionId);
      edge && onEventClick(edge);
    });
  }

  // Removes the DOM listeners and the click registrations.
  function dispose() {
    api.close();
  }
  invalidation?.then(dispose);
  // initRuntimeApi({ statechart, element: element });
  return Object.assign(element, { selectState, getTransitionEdges, dispose });
}
