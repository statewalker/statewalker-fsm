import { _ } from "../../lodash-es/index.ts";
import * as util from "../util.js";
import { positionX } from "./bk.js";

export { position };

function position(g) {
  g = util.asNonCompoundGraph(g);

  positionY(g);
  _.forOwn(positionX(g), (x, v) => {
    g.node(v).x = x;
  });
}

function positionY(g) {
  var layering = util.buildLayerMatrix(g);
  var rankSep = g.graph().ranksep;
  var prevY = 0;
  _.forEach(layering, (layer) => {
    var maxHeight = _.max(_.map(layer, (v) => g.node(v).height));
    _.forEach(layer, (v) => {
      g.node(v).y = prevY + maxHeight / 2;
    });
    prevY += maxHeight + rankSep;
  });
}
