import { Graph } from "../graphlib/index.js";
import { _ } from "../lodash-es/index.ts";
import * as util from "./util.js";

export { debugOrdering };

/* istanbul ignore next */
function debugOrdering(g) {
  var layerMatrix = util.buildLayerMatrix(g);

  var h = new Graph({ compound: true, multigraph: true }).setGraph({});

  _.forEach(g.nodes(), (v) => {
    h.setNode(v, { label: v });
    h.setParent(v, `layer${g.node(v).rank}`);
  });

  _.forEach(g.edges(), (e) => {
    h.setEdge(e.v, e.w, {}, e.name);
  });

  _.forEach(layerMatrix, (layer, i) => {
    var layerV = `layer${i}`;
    h.setNode(layerV, { rank: "same" });
    _.reduce(layer, (u, v) => {
      h.setEdge(u, v, { style: "invis" });
      return v;
    });
  });

  return h;
}
