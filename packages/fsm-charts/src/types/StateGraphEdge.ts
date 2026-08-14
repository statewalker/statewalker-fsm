import type { Dimensions } from "./Dimensions.js";
import type { Position } from "./Position.js";

/**
 * Information about a state graph edge.
 */
export type StateGraphEdge = Dimensions &
  Position & {
    id: string;
    from: string;
    event: string;
    to: string;
    points: Position[];
  } & Record<string, any>;
