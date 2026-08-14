import { BasisCurve } from "../../src/utils/BasisCurve.js";
import { describe, expect, it } from "../deps.js";

describe("BasisCurve", () => {
  it("should generate right sequence of control points", () => {
    const points = [
      {
        x: 140,
        y: 82,
      },
      {
        x: 98,
        y: 117,
      },
      {
        x: 98,
        y: 125,
      },
    ];

    const result: (string | number)[][] = [];
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
        result.push(["C", ...round(x0, y0, x1, y1, x2, y2)]);
      },
      moveTo(x: number, y: number) {
        result.push(["M", ...round(x, y)]);
      },
      lineTo(x: number, y: number) {
        result.push(["L", ...round(x, y)]);
      },
      closePath() {
        result.push(["Z"]);
      },
    });
    base.lineStart();
    for (const point of points) {
      base.point(point.x, point.y);
    }
    base.lineEnd();
    expect(result).toEqual([
      ["M", 140, 82],
      ["L", 133, 88],
      ["C", 126, 94, 112, 105, 105, 113],
      ["C", 98, 120, 98, 122, 98, 124],
      ["L", 98, 125],
    ]);
  });
});
