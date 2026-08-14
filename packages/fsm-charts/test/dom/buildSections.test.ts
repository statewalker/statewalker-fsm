// @vitest-environment jsdom
import { buildSections } from "../../src/dom/buildSections.js";
import { describe, expect, it } from "../deps.js";

function body(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("buildSections (adversarial-review #3/#4/#8)", () => {
  it("(a) does not crash on headers descending more than one level", () => {
    expect(() =>
      buildSections(body("<h4>a</h4><h3>b</h3><h2>c</h2><p>x</p>")),
    ).not.toThrow();
  });

  it("(b) retains sections whose header is shallower than a previous one", () => {
    const root = buildSections(
      body("<h2>A</h2><p>alpha</p><h1>B</h1><p>beta</p>"),
    );
    const headers = root.children.map((c) => c.header?.textContent);
    expect(headers).toEqual(["A", "B"]);
    const content = root.children.flatMap((c) =>
      c.content.map((n) => n.textContent),
    );
    expect(content).toEqual(["alpha", "beta"]);
  });

  it("(c) a top-level header after deep nesting is a sibling, not a child", () => {
    const root = buildSections(
      body("<h1>Top1</h1><h2>Sub</h2><h3>Deep</h3><h1>Top2</h1>"),
    );
    const headers = root.children.map((c) => c.header?.textContent);
    expect(headers).toEqual(["Top1", "Top2"]);
  });
});
