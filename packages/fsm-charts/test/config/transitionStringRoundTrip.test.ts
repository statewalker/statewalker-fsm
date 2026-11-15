import { concatTransitionsToString } from "../../src/config/concatTransitionsToString.js";
import { splitTransitionString } from "../../src/config/splitTransitionString.js";
import type { Transition } from "../../src/types/index.js";
import { describe, expect, it } from "../deps.js";

// Regression for #40: concatTransitionsToString and splitTransitionString did not round-trip.
const events = [
  "x",
  "",
  "*",
  "my event one",
  "on-click",
  "a>b",
  "->",
  "-",
  ">",
  'say "hi"',
  "it's",
  `both "double" and 'single'`,
  " padded ",
];

describe("concatTransitionsToString / splitTransitionString round trip (#40)", () => {
  for (const event of events) {
    it(`round-trips the event ${JSON.stringify(event)}`, () => {
      const transitions: Transition[] = [
        ["", "start", "A"],
        ["A", event, "B"],
        ["B", event, ""],
      ];
      const strings = concatTransitionsToString(transitions);
      expect(strings.flatMap(splitTransitionString)).toEqual(transitions);
    });
  }

  it("round-trips several tricky events in one chain", () => {
    const transitions: Transition[] = [
      ["A", "on-click", "B"],
      ["B", "a>b", "C"],
      ["C", "x", "A"],
    ];
    expect(concatTransitionsToString(transitions)).toEqual([`A -"on-click"-> B -"a>b"-> C -x-> A`]);
    expect(concatTransitionsToString(transitions).flatMap(splitTransitionString)).toEqual(
      transitions,
    );
  });

  it("strips the quotes around a quoted event when splitting", () => {
    expect(splitTransitionString(`A -"x"-> B`)).toEqual([["A", "x", "B"]]);
    expect(splitTransitionString(`A -'on-click'-> B`)).toEqual([["A", "on-click", "B"]]);
  });
});
