import * as lodash from "lodash-es";
import { buildStatechartSvg } from "../../src/html/index.js";
import { buildFlatCharts, getGraphParamsProvider } from "../../src/layout/index.js";
import { describe, expect, it } from "../deps.js";

// Regression for #43: invalid `strokeWidth` and lowercase `viewbox` attributes.
function renderSvg() {
  let counter = 0;
  const newId = (prefix: string) => `${prefix}_${counter++}`;
  const { getStateParams, getTransitionParams } = getGraphParamsProvider();
  const graph = buildFlatCharts({
    lodash,
    transitions: [
      ["", "start", "A"],
      ["A", "next", "B"],
      ["B", "exit", ""],
    ],
    newId,
    getStateParams,
    getTransitionParams,
  });
  const lines: string[] = [];
  buildStatechartSvg({ graph, newId, println: (s) => lines.push(s) });
  return lines.join("\n");
}

describe("buildStatechartSvg attributes (#43)", () => {
  it("writes a case-correct viewBox", () => {
    const svg = renderSvg();
    expect(svg).toMatch(/<svg [^>]*viewBox="0 0 \d+ \d+"/);
    expect(svg).not.toContain("viewbox=");
  });
  it("writes stroke-width, never the invalid strokeWidth", () => {
    const svg = renderSvg();
    expect(svg).not.toContain("strokeWidth");
    expect(svg).toMatch(/<rect [^>]*class="state__box"[^>]*stroke-width="2"/);
    expect(svg).toMatch(/<circle [^>]*class="state__initial"[^>]*stroke-width="2"/);
  });
});
