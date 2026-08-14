import type { StateGraphNode } from "./StateGraphNode.js";
import type { TransitionsGraph } from "./TransitionsGraph.js";

export type StateChart = TransitionsGraph &
  StateGraphNode & {
    children?: StateChart[];
  } & Record<string, any>;
