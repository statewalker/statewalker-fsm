import type { Dimensions } from "./Dimensions.js";
import type { Position } from "./Position.js";
import type { StateGraphEdge } from "./StateGraphEdge.js";
import type { StateGraphNode } from "./StateGraphNode.js";

/**
 * Coordinates for state nodes and endges corresponding to state transitions.
 */
export type TransitionsGraph = Position &
  Dimensions & {
    nodes: StateGraphNode[];
    edges: StateGraphEdge[];
  };
