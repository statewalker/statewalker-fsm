import { serializeAttrs } from "../../src/utils/serializeAttrs.js";
import { describe, expect, it } from "../deps.js";

describe("serializeAttrs (adversarial-review #10)", () => {
  it("escapes a double-quote as the valid &quot; entity, not &qout;", () => {
    const out = serializeAttrs({ label: 'say "hi"' });
    expect(out).toContain("&quot;");
    expect(out).not.toContain("&qout;");
  });
});
