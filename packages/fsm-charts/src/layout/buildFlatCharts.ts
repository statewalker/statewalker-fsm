import { layout } from "../dagre/layout.js";
import { Graph } from "../graphlib/graph.js";
import { getLodash, setLodash } from "../lodash-es/index.js";
import type { Dimensions } from "../types/Dimensions.js";
import type { GraphParamsProvider } from "../types/GraphParamsProvider.js";
import type { Padding } from "../types/Padding.js";
import type { Position } from "../types/Position.js";
import type { StateGraphEdge } from "../types/StateGraphEdge.js";
import type { StateGraphNode } from "../types/StateGraphNode.js";
import type { Transition } from "../types/Transition.js";
import type { TransitionsGraph } from "../types/TransitionsGraph.js";
import { getPadding } from "../utils/getPadding.js";
import { DEFAULT_FINAL_STATE_KEY, DEFAULT_INITIAL_STATE_KEY } from "../utils/pseudoStateKeys.js";

/**
 * Build graphs corresponding to the specified transitions.
 * @param transitions - The transitions between states.
 * @param newId - A function that generates unique ids for nodes and edges.
 * @param getStateParams - A function that returns the dimensions of a state node.
 * @param getTransitionParams - A function that returns the dimensions of a transition edge.
 * @param initialStateKey - The key for the initial state; recorded on the result.
 * @param finalStateKey - The key for the final state; recorded on the result.
 * @param vertical - Whether the graph should be vertical.
 * @returns {TransitionsGraph} - The graph with nodes and edges.
 */

export function buildFlatCharts({
  lodash,
  transitions = [],
  newId,
  getStateParams,
  getTransitionParams,
  padding = [5, 5],
  initialStateKey = DEFAULT_INITIAL_STATE_KEY,
  finalStateKey = DEFAULT_FINAL_STATE_KEY,
  vertical = false,
  direction,
}: {
  transitions?: Transition[];
  lodash: any;
  newId: (prefix: string) => string;
  initialStateKey?: string;
  finalStateKey?: string;
  vertical?: boolean;
  padding?: Padding;
  direction?: "tb" | "bt" | "lr" | "rl";
} & GraphParamsProvider): TransitionsGraph {
  const prevLodash = getLodash();
  try {
    setLodash(lodash);
    const rankdir = direction || (vertical ? "tb" : "lr");
    const graph = new Graph({
      directed: true,
      multigraph: true,
    }).setGraph({ rankdir, multigraph: true });

    const nodesIndex: Record<string, string> = {};

    const getStateNodeId = (key: string, state: string = key) => {
      let id = nodesIndex[key];
      if (!id) {
        id = nodesIndex[key] = newId("s");
        const params = getStateParams(key, state);
        graph.setNode(id, { id, ...params });
      }
      return id;
    };

    for (const [fromState, event, toState] of transitions) {
      const fromStateKey = fromState || initialStateKey;
      const from = getStateNodeId(fromStateKey, fromState);
      const toStateKey = toState || finalStateKey;
      const to = getStateNodeId(toStateKey, toState);
      const params = getTransitionParams(fromStateKey, event, toStateKey);
      const edgeId = newId("t");
      graph.setEdge(
        from,
        to,
        {
          id: edgeId,
          ...params,
        },
        edgeId,
      );
    }
    layout(graph, { rankdir });

    const [top, right, bottom, left] = getPadding(padding);

    const nodes = graph.nodes().map((id: string) => {
      const n = graph.node(id) as StateGraphNode;
      n.x += -n.width / 2;
      n.y += -n.height / 2;
      return n;
    });
    const edges = graph.edges().map(({ v, w, name }: { v: string; w: string; name: string }) => {
      const e = graph.edge(v, w, name) as StateGraphEdge;
      e.x += -e.width / 2;
      e.y += -e.height / 2;
      return e;
    });

    // Get the bounding box of the graph (boxes and every edge point)
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    const addPoint = (px: number, py: number) => {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    };
    const addBox = (node: StateGraphNode | StateGraphEdge) => {
      addPoint(node.x, node.y);
      addPoint(node.x + node.width, node.y + node.height);
    };
    nodes.forEach(addBox);
    edges.forEach(addBox);
    edges.forEach((edge) => {
      for (const point of edge.points) {
        addPoint(point.x, point.y);
      }
    });

    // Shift the graph to the origin taking into account the padding
    // (the top-left corner of the bounding box moves to the padding).
    const x = 0;
    const y = 0;
    const width = maxX - minX + left + right;
    const height = maxY - minY + bottom + top;
    const updateCoords = (node: Position) => {
      node.x = Math.round(node.x - minX + left);
      node.y = Math.round(node.y - minY + bottom);
    };
    const updateBox = (node: Position & Dimensions) => {
      updateCoords(node);
      node.y = Math.round(node.y + node.height);
    };
    nodes.forEach(updateBox);
    edges.forEach(updateBox);
    edges.forEach((edge) => {
      edge.points.forEach(updateCoords);
    });

    return { x, y, width, height, nodes, edges, initialStateKey, finalStateKey };
  } finally {
    setLodash(prevLodash);
  }
}
