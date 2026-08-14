import { splitTransitionString } from "../../src/config/splitTransitionString.js";
import { describe, expect, it } from "../deps.js";

describe("splitTransitionString", () => {
  it("should transform empty string to an empty transition list", () => {
    expect(splitTransitionString(``)).toEqual([]);
  });
  it("should transform a string without transition patterns to an empty transition list", () => {
    expect(splitTransitionString(`ABC`)).toEqual([]);
  });
  it("should transform anonymous transitions", () => {
    expect(splitTransitionString(`-->`)).toEqual([["", "", ""]]);
    expect(splitTransitionString(`A-->`)).toEqual([["A", "", ""]]);
    expect(splitTransitionString(`  A  -->`)).toEqual([["A", "", ""]]);
    expect(splitTransitionString(`-->B`)).toEqual([["", "", "B"]]);
    expect(splitTransitionString(`-->  B  `)).toEqual([["", "", "B"]]);
    expect(splitTransitionString(`A-->B`)).toEqual([["A", "", "B"]]);
    expect(splitTransitionString(`A  -->  B`)).toEqual([["A", "", "B"]]);
  });
  it("should transform labeled transitions without initial and final states", () => {
    expect(splitTransitionString(`-x->`)).toEqual([["", "x", ""]]);
    expect(splitTransitionString(`A-x->`)).toEqual([["A", "x", ""]]);
    expect(splitTransitionString(`  A  -x->`)).toEqual([["A", "x", ""]]);
    expect(splitTransitionString(`-x->B`)).toEqual([["", "x", "B"]]);
    expect(splitTransitionString(`-x->  B  `)).toEqual([["", "x", "B"]]);
    expect(splitTransitionString(`A-x->B`)).toEqual([["A", "x", "B"]]);
    expect(splitTransitionString(`A  -x->  B`)).toEqual([["A", "x", "B"]]);
  });

  it("should split strings with sequential multiple transitions", () => {
    expect(splitTransitionString(`A-->B-->C-->D`)).toEqual([
      ["A", "", "B"],
      ["B", "", "C"],
      ["C", "", "D"],
    ]);
    expect(splitTransitionString(`-->A-->B-->C-->D-->`)).toEqual([
      ["", "", "A"],
      ["A", "", "B"],
      ["B", "", "C"],
      ["C", "", "D"],
      ["D", "", ""],
    ]);
    expect(splitTransitionString(`A-ok->B-ok->C-ok->D`)).toEqual([
      ["A", "ok", "B"],
      ["B", "ok", "C"],
      ["C", "ok", "D"],
    ]);
    expect(splitTransitionString(`-ok->A-ok->B-ok->C-ok->D-ok->`)).toEqual([
      ["", "ok", "A"],
      ["A", "ok", "B"],
      ["B", "ok", "C"],
      ["C", "ok", "D"],
      ["D", "ok", ""],
    ]);

    expect(
      splitTransitionString(
        `-next->A -next-> B -next-> C -prev-> B -prev-> A -*-> C -exit-> `,
      ),
    ).toEqual([
      ["", "next", "A"],
      ["A", "next", "B"],
      ["B", "next", "C"],
      ["C", "prev", "B"],
      ["B", "prev", "A"],
      ["A", "*", "C"],
      ["C", "exit", ""],
    ]);
  });
  expect(splitTransitionString(`A-x->B-y->A-x->B-y->A-x->B-y->A`)).toEqual([
    ["A", "x", "B"],
    ["B", "y", "A"],
    ["A", "x", "B"],
    ["B", "y", "A"],
    ["A", "x", "B"],
    ["B", "y", "A"],
  ]);
});
