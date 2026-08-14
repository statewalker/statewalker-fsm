import { concatTransitionsToString } from "../../src/config/concatTransitionsToString.js";
import { describe, expect, it } from "../deps.js";

describe("concatTransitionsToString", () => {
  it("should recreate basic transition strings", () => {
    expect(concatTransitionsToString([])).toEqual([]);
    expect(concatTransitionsToString([["", "", ""]])).toEqual([" --> "]);
    expect(concatTransitionsToString([["A", "", ""]])).toEqual(["A --> "]);
    expect(concatTransitionsToString([["", "", "B"]])).toEqual([" --> B"]);
    expect(concatTransitionsToString([["A", "", "B"]])).toEqual(["A --> B"]);
    expect(concatTransitionsToString([["A", "x", "B"]])).toEqual(["A -x-> B"]);
  });
  it("should multiple strings (for cycles etc)", () => {
    expect(
      concatTransitionsToString([
        ["A", "", "B"],
        ["B", "", "A"],
        ["B", "x", "C"],
      ]),
    ).toEqual(["A --> B --> A", "B -x-> C"]);
    expect(
      concatTransitionsToString([
        ["A", "", "B"],
        ["B", "x", "C"],
        ["B", "", "A"],
      ]),
    ).toEqual(["A --> B -x-> C", "B --> A"]);
  });
  it("should recreate long transition strings from an array of individual transitions", () => {
    expect(
      concatTransitionsToString([
        ["", "*", "OpenFileSystem"],
        ["OpenFileSystem", "my event one", "OpenFileSystem"],
        ["OpenFileSystem", "error", "ShowError"],
        ["ShowError", "ok", "OpenFileSystem"],
        ["OpenFileSystem", "exit", ""],
      ]),
    ).toEqual([
      " -*-> OpenFileSystem -my event one-> OpenFileSystem -error-> ShowError -ok-> OpenFileSystem -exit-> ",
    ]);
  });
});
