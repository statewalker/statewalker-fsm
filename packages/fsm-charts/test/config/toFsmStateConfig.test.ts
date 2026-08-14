import { toFsmStateConfig } from "../../src/config/toFsmStateConfig.js";
import { describe, expect, it } from "../deps.js";

describe("toFsmStateConfig", () => {
  it("should keep states with empty transitions", () => {
    expect(typeof toFsmStateConfig).toBe("function");
    expect(
      toFsmStateConfig({
        key: "N",
        transitions: [],
      }),
    ).toEqual({
      key: "N",
      transitions: [],
    });
  });
  it("should keep additional properties", () => {
    expect(
      toFsmStateConfig({
        key: "N",
        description: "Test state",
        transitions: [],
      }),
    ).toEqual({
      key: "N",
      description: "Test state",
      transitions: [],
    });
    expect(
      toFsmStateConfig({
        key: "N",
        foo: "Foo",
        description: "Test state",
        transitions: [["A", "o", "B"]],
        states: [
          {
            key: "A",
            bar: "Bar",
          },
          {
            key: "B",
            baz: "Baz",
          },
        ],
      }),
    ).toEqual({
      key: "N",
      foo: "Foo",
      description: "Test state",
      transitions: [["A", "o", "B"]],
      states: [
        {
          key: "A",
          bar: "Bar",
          transitions: [],
        },
        {
          key: "B",
          baz: "Baz",
          transitions: [],
        },
      ],
    });
  });

  it("should remove duplicated transitions", () => {
    expect(typeof toFsmStateConfig).toBe("function");
    expect(
      toFsmStateConfig({
        key: "N",
        transitions: [
          ["A", "x", "B"],
          ["B", "y", "A"],
          ["A", "x", "B"],
          ["B", "y", "A"],
          ["A", "x", "B"],
          ["B", "y", "A"],
        ],
      }),
    ).toEqual({
      key: "N",
      transitions: [
        ["A", "x", "B"],
        ["B", "y", "A"],
      ],
    });
  });
});
