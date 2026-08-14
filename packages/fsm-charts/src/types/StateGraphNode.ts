import type { Dimensions } from "./Dimensions.js";
import type { Position } from "./Position.js";

/**
 * Information about a state node in the graph.
 */
export type StateGraphNode = Dimensions &
  Position & {
    id: string;
    key: string;
    text: string;
    // state: string;
  } & Record<string, any>;
