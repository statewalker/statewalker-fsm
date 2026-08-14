import type {
  Dimensions,
  Padding,
  Position,
  TransitionsGraph,
} from "../types/index.js";
import { BasisCurve } from "../utils/BasisCurve.js";
import { getPadding } from "../utils/getPadding.js";
import { serializeAttrs } from "../utils/serializeAttrs.js";

function getBoxParams({
  x,
  y,
  width,
  height,
  padding = 0,
}: Position & Dimensions & { padding?: Padding }) {
  const [top, right, bottom, left] = getPadding(padding);
  const h = Math.ceil(height - top - bottom);
  return {
    x: x + left,
    y: y - bottom - h,
    width: Math.ceil(width - left - right),
    height: h,
  };
}

export function buildStatechartSvg({
  graph: { width, height, nodes, edges },
  newId,
  stateFontSize = 14,
  transitionFontSize = 12,
  println,
  initialStateKey = "<initial>",
  finalStateKey = "<final>",
}: {
  graph: TransitionsGraph;
  newId: (prefix: string) => string;
  println: (str: string) => void;
  stateFontSize?: number;
  transitionFontSize?: number;
  initialStateKey?: string;
  finalStateKey?: string;
}) {
  if (!nodes.length && !edges.length) return;
  width = Math.ceil(width);
  height = Math.ceil(height);
  println(
    `<svg ${serializeAttrs({
      class: "statechart",
      width,
      height,
      viewbox: `0 0 ${width} ${height}`,
      xmlns: "http://www.w3.org/2000/svg",
    })}>`,
  );

  /*
  --------------------------------------------------- 
  Transitions visualization

  CSS Classes:
  .transitions .transition-marker
  .transitions .transition .transition-line
  .transitions .transition .transition-box
  .transitions .transition .transition-label
   --------------------------------------------------- 
  */
  println(`<g class="statechart__transitions">`);

  const markerAttrs = serializeAttrs({
    refX: 19,
    refY: 7,
    markerWidth: 20,
    markerHeight: 14,
    orient: "auto",
    class: "transition__marker",
    stroke: "none",
    fill: "currentColor",
  });

  for (const edge of edges) {
    const { id, points, text } = edge;
    println(`  <g class="transition" data-transition-id="${id}">`);
    const markerId = newId("marker");

    println(`    <defs>`);
    println(`      <marker id="${markerId}" ${markerAttrs}>`);
    println(`        <path d="M 19,7 L9,13 L14,7 L9,1 Z"></path>`);
    println(`      </marker>`);
    println(`    </defs>`);

    const path: string[] = [];
    const round = (...n: number[]) => n.map(Math.round);
    const base = new BasisCurve({
      bezierCurveTo(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
      ) {
        path.push(`C${round(x0, y0, x1, y1, x2, y2).join(",")}`);
      },
      moveTo(x: number, y: number) {
        path.push(`M${round(x, y).join(",")}`);
      },
      lineTo(x: number, y: number) {
        path.push(`L${round(x, y).join(",")}`);
      },
      closePath() {
        path.push("Z");
      },
    });
    base.lineStart();
    for (const point of points) {
      base.point(point.x, point.y);
    }
    base.lineEnd();

    const serializedAttrs = serializeAttrs({
      class: "transition__line",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1px",
      d: path.join(""),
      "marker-end": `url(#${markerId})`,
    });
    println(`    <path ${serializedAttrs} />`);

    if (text) {
      const { x, y, width, height } = getBoxParams({
        ...edge,
        padding: 0,
      });

      const rectAttrs = serializeAttrs({
        x,
        y: y - transitionFontSize,
        width,
        height,
        rx: Math.ceil(transitionFontSize / 2),
        ry: Math.ceil(transitionFontSize / 2),
        fill: "rgba(255,255,255,0.7)",
        stroke: "none",
        strokeWidth: "1",
        class: "transition__box",
      });
      println(`    <rect ${rectAttrs} />`);

      const textAttrs = serializeAttrs({
        class: "transition__label",
        "text-anchor": "middle",
        fill: "currentColor",
        x: Math.round(x + width / 2),
        y: Math.round(y + height / 2 - transitionFontSize / 2),
      });
      println(`    <text ${textAttrs}>${text}</text>`);
    }
    println(`  </g>`);
  }
  println("</g>");

  /*
  --------------------------------------------------- 
  States visualization

  CSS Classes:
  .states .state
  .states .state .state-box 
  .states .state .state-initial 
  .states .state .state-final 
  .states .state .state-final.inner 
  .states .state .state-label
   --------------------------------------------------- 
  */

  const shift = stateFontSize / 4;
  const initialStateRadius = 6;
  const finalStateRadius = initialStateRadius / 2;

  println(`<g class="statechart__states">`);
  for (const node of nodes) {
    const { key, id, text } = node;
    const { x, y, width, height } = getBoxParams({ ...node, padding: shift });

    println(`  <g class="state" data-state-id="${id}">`);
    if (key === initialStateKey || key === finalStateKey) {
      const cx = Math.round(x + width / 2);
      const cy = Math.round(y + height / 2);
      if (key === initialStateKey) {
        const serializedAttrs = serializeAttrs({
          class: "state__initial",
          cx,
          cy,
          r: initialStateRadius,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
        });
        println(`    <circle ${serializedAttrs} />`);
      } else {
        let serializedAttrs = serializeAttrs({
          class: "state__final",
          cx,
          cy,
          r: initialStateRadius,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
        });
        println(`    <circle ${serializedAttrs} />`);

        serializedAttrs = serializeAttrs({
          class: "state__final state__final--inner",
          cx,
          cy,
          r: finalStateRadius,
          fill: "currentColor",
          stroke: "none",
          strokeWidth: 0,
        });
        println(`    <circle ${serializedAttrs} />`);
      }
    } else {
      const rectAttrs = serializeAttrs({
        x,
        y,
        width,
        height,
        rx: Math.ceil(stateFontSize / 2),
        ry: Math.ceil(stateFontSize / 2),
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        class: "state__box",
      });
      println(`    <rect ${rectAttrs} />`);

      const textAttrs = serializeAttrs({
        class: "state__label",
        "text-anchor": "middle",
        fill: "currentColor",
        x: Math.round(x + width / 2),
        y: Math.round(y + height / 2 + stateFontSize / 4),
      });
      println(`    <text ${textAttrs}>${text}</text>`);
    }
    println("  </g>");
  }
  println("</g>");

  println("</svg>");
}
