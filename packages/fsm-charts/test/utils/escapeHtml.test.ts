import { escapeHtml } from "../../src/utils/escapeHtml.js";
import { describe, expect, it } from "../deps.js";

describe("escapeHtml (#29)", () => {
  it("escapes the five markup-significant characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
  it("escapes `&` first, so existing entities are not double-decoded", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
  it("turns undefined and numbers into strings", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});
