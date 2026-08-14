import { _ } from "../../lodash-es/index.ts";
import { dijkstra } from "./dijkstra.js";

export { dijkstraAll };

function dijkstraAll(g, weightFunc, edgeFunc) {
  return _.transform(
    g.nodes(),
    (acc, v) => {
      acc[v] = dijkstra(g, v, weightFunc, edgeFunc);
    },
    {},
  );
}
