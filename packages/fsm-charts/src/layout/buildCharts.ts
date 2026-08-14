import type { FsmStateConfig } from "../types/FsmStateConfig.js";
import type { GraphParamsProvider } from "../types/GraphParamsProvider.js";
import type { Padding } from "../types/Padding.js";
import type { StateChart } from "../types/StateChart.js";

import { buildFlatCharts } from "./buildFlatCharts.js";
/**
 * Build graphs corresponding to the specified transitions.
 * @param config - State configuration with transitions and sub-states.
 * @param newId - A function that generates unique ids for nodes and edges.
 * @param getStateParams - A function that returns the dimensions of a state node.
 * @param getTransitionParams - A function that returns the dimensions of a transition edge.
 * @param initialStateKey - The key for the initial state.
 * @param finalStateKey - The key for the final state.
 * @returns {StateChart} - The graph with nodes and edges.
 */
export function buildCharts({
  lodash,
  config,
  newId,
  getStateParams,
  getStateLabel = (stateKey: string) =>
    stateKey.replace(/([a-z])([A-Z])/g, "$1 $2"),
  getTransitionParams,
  padding = [5, 5],
  vertical = false,
  initialStateKey = "<initial>",
  finalStateKey = "<final>",
  direction,
}: {
  config: FsmStateConfig;
  lodash: any;
  newId: (prefix: string) => string;
  initialStateKey?: string;
  finalStateKey?: string;
  padding?: Padding;
  vertical?: boolean;
  direction?: "tb" | "bt" | "lr" | "rl";
  getStateLabel?: (stateKey: string) => string | undefined;
} & GraphParamsProvider): StateChart {
  return buildChart(config);

  function buildChart(
    config: FsmStateConfig,
    id: string = newId("s"),
    stack: Array<FsmStateConfig> = [],
  ): StateChart {
    stack.push(config);

    try {
      const buildStateLabel = (state: string, key: string = state) => {
        if (key === initialStateKey || key === finalStateKey) {
          return "";
        }

        let result: string | undefined;
        for (let i = stack.length - 1; result === undefined && i >= 0; i--) {
          const conf = stack[i];
          if (!conf.states) continue;
          for (const subState of conf.states) {
            if (subState.key !== state) continue;
            result = subState.label ?? getStateLabel(state);
            break;
          }
        }

        return result ?? getStateLabel(state) ?? state;
      };
      const graph = buildFlatCharts({
        lodash,
        transitions: config.transitions || [],
        newId,
        getStateParams: (state: string, key?: string) => {
          const params = getStateParams(state, key);
          delete params.state;
          params.text = buildStateLabel(state, key);
          return params;
        },
        getTransitionParams,
        padding,
        initialStateKey,
        finalStateKey,
        vertical,
        direction,
      });
      const index = graph.nodes.reduce(
        (index, node) => {
          index[node.key as string] = node.id as string;
          return index;
        },
        {} as Record<string, string>,
      );
      const text = config.label ?? getStateLabel(config.key) ?? config.key;

      const children: StateChart[] = [];
      if (config.states) {
        for (const child of config.states) {
          const childId = index[child.key];
          children.push(buildChart(child, childId, [...stack]));
        }
      }

      // const state = text;
      return {
        id,
        key: config.key,
        // state,
        text,
        ...graph,
        children,
      };
    } finally {
      // stack.pop();
    }
  }
}
