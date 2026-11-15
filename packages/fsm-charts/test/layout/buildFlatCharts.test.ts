import * as lodash from "lodash-es";
import { buildFlatCharts } from "../../src/layout/buildFlatCharts.js";
import { getGraphParamsProvider } from "../../src/layout/getGraphParamsProvider.js";
import type { Transition, TransitionsGraph } from "../../src/types/index.js";
import { describe, expect, it } from "../deps.js";
import { tests } from "./buildFlatCharts.data.js";

describe("buildFlatCharts", () => {
  for (const { message, transitions, control } of tests) {
    it(message, () => {
      testCharts(transitions, control);
    });
  }

  // Regression for #43: the bounding box ignored edge points' own coordinates and never
  // applied its offset, so points with negative coordinates fell outside the canvas.
  for (const { message, transitions } of tests) {
    it(`keeps every node, label and edge point inside the canvas: ${message}`, () => {
      expectInsideCanvas(build(transitions));
    });
  }

  function expectInsideCanvas(graph: TransitionsGraph) {
    const outside: string[] = [];
    const check = (what: string, x: number, y: number) => {
      if (x < 0 || y < 0 || x > graph.width || y > graph.height) {
        outside.push(`${what} (${x}, ${y})`);
      }
    };
    for (const box of [...graph.nodes, ...graph.edges]) {
      // `y` is the bottom edge of a box.
      check(`box ${box.id} top-left`, box.x, box.y - box.height);
      check(`box ${box.id} bottom-right`, box.x + box.width, box.y);
    }
    for (const edge of graph.edges) {
      for (const point of edge.points) check(`edge ${edge.id} point`, point.x, point.y);
    }
    expect(outside).toEqual([]);
  }

  function build(transitions: Transition[]): TransitionsGraph {
    let idCounter = 0;
    const { getStateParams, getTransitionParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 3,
      transitionsFontSize: 12,
      transitionsTextPadding: 3,
    });
    return buildFlatCharts({
      lodash,
      transitions,
      newId: (prefix: string) => `${prefix}_${idCounter++}`,
      getStateParams,
      getTransitionParams,
    });
  }

  function testCharts(transitions: Transition[], expected: TransitionsGraph) {
    let idCounter = 0;
    const { getStateParams, getTransitionParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 3,
      transitionsFontSize: 12,
      transitionsTextPadding: 3,
    });
    const result = buildFlatCharts({
      lodash,
      transitions,
      newId: (prefix: string) => `${prefix}_${idCounter++}`,
      getStateParams,
      getTransitionParams,
    });
    try {
      // The pseudo-state keys travel with the built graph (#22).
      expect(result).toEqual({
        ...expected,
        initialStateKey: "<initial>",
        finalStateKey: "<final>",
      });
    } catch (err) {
      console.log(JSON.stringify(result, null, 2));
      throw err;
    }
  }
});
