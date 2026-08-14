import { toKebabCase } from "../../src/utils/toKebabCase.js";
import { describe, expect, it } from "../deps.js";

describe("toKebabCase", () => {
  it("should transform CamelCaseString to kebab-case-string", async () => {
    expect(toKebabCase("")).toBe("");
    expect(toKebabCase("Foo")).toBe("-foo");
    expect(toKebabCase("fooBar")).toBe("foo-bar");
    expect(toKebabCase("FooBarBaz")).toBe("-foo-bar-baz");
    expect(toKebabCase("-FooBarBaz")).toBe("--foo-bar-baz");
  });
  it("should remove space chars", async () => {
    expect(toKebabCase("Foo Bar")).toBe("-foo--bar");
    expect(toKebabCase("   Foo    Bar   ")).toBe("-foo--bar");
  });
});
