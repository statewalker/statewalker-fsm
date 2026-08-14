import { serializeCss } from "../../src/index.js";
import { describe, expect, it } from "../deps.js";

describe("serializeCss - simple CSS classes serialization", () => {
  it("should CSS from objects", () => {
    expect(serializeCss({})).toEqual("");
  });
  it("should serialize string properties", () => {
    expect(
      serializeCss({
        ".foo": {
          color: "red",
        },
      }),
    ).toEqual(`.foo {
  color: red;
}`);
  });
  it("should serialize number properties", () => {
    expect(
      serializeCss({
        ".foo": {
          "--border-width": 3,
        },
      }),
    ).toEqual(`.foo {
  --border-width: 3;
}`);
  });
  it("should serialize CSS variables", () => {
    expect(
      serializeCss({
        ".foo": {
          "--foo-bar": "red",
        },
      }),
    ).toEqual(`.foo {
  --foo-bar: red;
}`);
  });
  it("should transform camelStyleParemeters to kebab-style-parameters", () => {
    expect(
      serializeCss({
        ".myClass": {
          borderWidth: "3px",
        },
      }),
    ).toEqual(`.myClass {
  border-width: 3px;
}`);
  });
});

describe("serializeCss - hierarchical styles serialization", () => {
  it("should generate CSS from hierarchy of objects", () => {
    expect(
      serializeCss({
        ".a": {
          ".b": {
            ".c": {
              color: "red",
            },
          },
        },
      }),
    ).toEqual(`.a .b .c {
  color: red;
}`);
  });

  it("should generate CSS from hierarchy of objects with styles overloading", () => {
    expect(
      serializeCss({
        ".a": {
          color: "red",
          ".b": {
            color: "green",
            ".c": {
              color: "blue",
            },
          },
        },
      }),
    ).toEqual(`.a {
  color: red;
}
.a .b {
  color: green;
}
.a .b .c {
  color: blue;
}`);
  });
  it("should combine classes", () => {
    expect(
      serializeCss({
        ".a": {
          color: "red",
          "&.b": {
            color: "green",
            "&.c": {
              color: "blue",
            },
          },
        },
      }),
    ).toEqual(`.a {
  color: red;
}
.a.b {
  color: green;
}
.a.b.c {
  color: blue;
}`);
  });
});
