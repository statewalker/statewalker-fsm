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
    /**
     * Key of the pseudo-state node drawn for an empty transition source,
     * recorded when the graph is built (`"<initial>"` unless overridden).
     */
    initialStateKey?: string;
    /**
     * Key of the pseudo-state node drawn for an empty transition target,
     * recorded when the graph is built (`"<final>"` unless overridden).
     */
    finalStateKey?: string;
  };
