import { serializeAttrs } from "../../src/utils/serializeAttrs.js";
import { describe, expect, it } from "../deps.js";

describe("serializeAttrs (adversarial-review #10)", () => {
  it("escapes a double-quote as the valid &quot; entity, not &qout;", () => {
    const out = serializeAttrs({ label: 'say "hi"' });
    expect(out).toContain("&quot;");
    expect(out).not.toContain("&qout;");
  });
});

describe("serializeAttrs escaping (#29)", () => {
  it("escapes `&` so a value cannot smuggle an entity", () => {
    expect(serializeAttrs({ title: "a&b" })).toBe('title="a&amp;b"');
    expect(serializeAttrs({ title: "&quot;" })).toBe('title="&amp;quot;"');
  });
  it("escapes `<`, `>`, quotes in values", () => {
    expect(serializeAttrs({ title: `<"'>` })).toBe('title="&lt;&quot;&#39;&gt;"');
  });
});
