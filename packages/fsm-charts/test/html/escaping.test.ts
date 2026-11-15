import * as lodash from "lodash-es";
import { buildStatechartSvg } from "../../src/html/index.js";
import { buildFlatCharts, getGraphParamsProvider } from "../../src/layout/index.js";
import type { FsmStateConfig } from "../../src/types/index.js";
import { describe, expect, it } from "../deps.js";
import { toStatechartsPanels } from "./toStatechartsPanels.js";

// Regression for #29: labels, ids and the summary label reached the markup unescaped.
const config: FsmStateConfig = {
  key: "Main",
  label: "<b>Main</b> & co",
  transitions: [
    ["", "<img src=x onerror=alert(1)>", "S1"],
    ["S1", "go", "</text><script>alert(2)</script>"],
    ["S1", "<enter>", "S2"],
  ],
};

describe("markup escaping (#29)", () => {
  it("escapes transition labels, state labels and the summary label in the panel", () => {
    const { html } = toStatechartsPanels(config);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;/text&gt;&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).toContain("&lt;enter&gt;");
    expect(html).toContain(
      '<summary class="state-details__label">&lt;b&gt;Main&lt;/b&gt; &amp; co</summary>',
    );
  });

  it("escapes ids written into the SVG", () => {
    let counter = 0;
    const newId = (prefix: string) => `${prefix}"><i>${counter++}`;
    const { getStateParams, getTransitionParams } = getGraphParamsProvider();
    const graph = buildFlatCharts({
      lodash,
      transitions: config.transitions,
      newId,
      getStateParams,
      getTransitionParams,
    });
    const lines: string[] = [];
    buildStatechartSvg({ graph, newId, println: (s) => lines.push(s) });
    const svg = lines.join("\n");
    expect(svg).not.toContain("<i>");
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain("<script");
    expect(svg).toContain('data-state-id="s&quot;&gt;&lt;i&gt;0"');
  });
});
