import { _ } from "../../lodash-es/index.ts";

export { barycenter };

function barycenter(g, movable) {
  return _.map(movable, (v) => {
    var inV = g.inEdges(v);
    if (!inV.length) {
      return { v: v };
    } else {
      var result = _.reduce(
        inV,
        (acc, e) => {
          var edge = g.edge(e),
            nodeU = g.node(e.v);
          return {
            sum: acc.sum + edge.weight * nodeU.order,
            weight: acc.weight + edge.weight,
          };
        },
        { sum: 0, weight: 0 },
      );

      return {
        v: v,
        barycenter: result.sum / result.weight,
        weight: result.weight,
      };
    }
  });
}
