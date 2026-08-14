import { serializeProcessConfig } from "../../src/config/serializeProcessConfig.js";
import { describe, expect, it } from "../deps.js";

describe("serializeProcessConfig", () => {
  it("should serialize configurations to JSON strings", () => {
    expect(typeof serializeProcessConfig).toBe("function");
    const result = serializeProcessConfig({
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
    expect(result).toEqual(
      `{
  "key": "N",
  "transitions": [
    ["A","o","B"]
  ],
  "states": [
    {
      "key": "A",
      "bar": "Bar"
    },
    {
      "key": "B",
      "baz": "Baz"
    }
  ],
  "foo": "Foo",
  "description": "Test state"
}`,
    );
  });
});
