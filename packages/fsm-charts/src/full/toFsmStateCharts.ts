import {
  buildStatechartCss,
  buildStatechartsPanel,
  type FsmStateConfig,
  type StateChart,
  type StateGraphEdge,
} from "../index-html.js";
import { buildCharts, getGraphParamsProvider } from "../index-layout.js";
import { RuntimeStatechartApi, StateChartIndex } from "../runtime/index.js";
import { newId } from "../utils/newId.js";
import { newRegistry } from "../utils/newRegistry.js";

export type FsmStateCharts = {
  api: RuntimeStatechartApi;
  index: StateChartIndex;
  statechart: StateChart;
  html: string;
  element: HTMLElement;

  register: (action: () => void) => () => void;
  cleanup: () => void;
};

export function toFsmStateCharts({
  config,
  lodash,
  onTransitionClick,
}: {
  onTransitionClick: (transition: StateGraphEdge) => unknown;
  config: FsmStateConfig;
  lodash: any;
}): FsmStateCharts {
  const statechart = buildCharts({
    lodash,
    newId,
    config,
    padding: [15, 15],
    ...getGraphParamsProvider({
      // fontSize: 14,
      stateFontSize: 14,
      stateTextPadding: [14, 16],
      transitionsFontSize: 12,
      transitionsTextPadding: 6,
    }),
  });
  const index = new StateChartIndex({ statechart });

  const lines: string[] = [];
  buildStatechartsPanel({
    statechart,
    newId,
    println: (str) => lines.push(str),
  });
  const html = lines.join("\n");
  const statechartId = newId("statechart");
  const css = buildStatechartCss({
    // prefix: `#${statechartId}`
  });

  const container = document.createElement("div");
  container.innerHTML = `${html}
<style>
${css}
#${statechartId} {
  padding: 0.5em 0;
}
</style>`;
  container.id = statechartId;
  // const style = container.querySelector("style");

  const [register, cleanup] = newRegistry();
  register(() => {
    container.remove();
  });

  const api = new RuntimeStatechartApi({
    element: container,
    statechart,
  });
  const topNodeId = index.getStackByStateId(statechart.id)[0].id;
  // api.selectState(topNodeId);
  api.openStatePanel(topNodeId);

  register(
    api.onStateClick((stateId) => {
      const nodes = index.getStackByStateId(stateId);
      const nodeIds = nodes.map((n) => n.id);
      api.deselectTransitions();
      const selected = api.toggleState(...nodeIds);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const stateId = node.id;
        if (i < nodes.length - 1 || selected) {
          const transitions = index.getTransitions(stateId);
          transitions.forEach((t) => api.selectTransition(t.id));
        }
      }
      // api.focusStates(...nodeIds);
    }),
  );

  if (onTransitionClick) {
    register(
      api.onTransitionClick((transitionId) => {
        const transition = index.getEdgeById(transitionId);
        transition && onTransitionClick(transition);
      }),
    );
  }
  return {
    register,
    cleanup,
    statechart,
    api,
    html,
    element: container,
    index,
  };
}
