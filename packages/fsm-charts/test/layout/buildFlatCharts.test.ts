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
      expect(result).toEqual(expected);
    } catch (err) {
      console.log(JSON.stringify(result, null, 2));
      throw err;
    }
  }
});
