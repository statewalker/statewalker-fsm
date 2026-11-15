import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";

/**
 * Key resolution is DYNAMIC, as in the engine (statewalker-fsm#25): the
 * runtime's `findStateDescriptor` walks the LIVE state's `parent` chain, so a
 * definition shared from an ancestor and entered inside scope A resolves its
 * own keys through A and A's live ancestors, not through the scope that holds
 * the definition. The validator follows every instantiation path.
 */
describe("Dynamic key resolution (per instantiation path)", () => {
  /**
   * Root has states [X, B]; X has states [A, C]; A enters B, which is defined
   * in Root and enters C. The runtime enters Root/X/A/B/C: B's lookup of C
   * walks B → A → X and finds X's C.
   */
  const sharedResolvedThroughCaller: FsmStateConfig = {
    key: "Root",
    transitions: [
      ["", "*", "X"],
      ["X", "done", ""],
    ],
    states: [
      {
        key: "X",
        transitions: [
          ["", "*", "A"],
          ["A", "done", ""],
        ],
        states: [
          {
            key: "A",
            transitions: [
              ["", "*", "B"],
              ["B", "done", ""],
            ],
            events: { done: "When B completes" },
          },
          { key: "C", events: { done: "When C completes" } },
        ],
        events: { done: "When A completes" },
      },
      {
        key: "B",
        transitions: [
          ["", "*", "C"],
          ["C", "done", ""],
        ],
        events: { done: "When C completes" },
      },
    ],
  };

  it("accepts a shared definition whose keys resolve only through the scope entering it", () => {
    const result = validate(sharedResolvedThroughCaller);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("does not report S2 or S4 for the key resolved through the caller", () => {
    const result = validate(sharedResolvedThroughCaller, { rules: ["S1", "S2", "S3", "S4"] });
    expect(result.issues).toEqual([]);
  });

  /**
   * A defines its own composite C; B, shared from Root, enters C. The runtime
   * enters A's C (Root/A/B/C/Deep), not Root's C.
   */
  const shadowedThroughCaller: FsmStateConfig = {
    key: "Root",
    transitions: [
      ["", "*", "A"],
      ["A", "done", ""],
    ],
    states: [
      {
        key: "A",
        transitions: [
          ["", "*", "B"],
          ["B", "done", ""],
        ],
        states: [
          {
            key: "C",
            transitions: [
              ["", "*", "Deep"],
              ["Deep", "done", ""],
            ],
            states: [{ key: "Deep", events: { done: "When Deep completes" } }],
            events: { done: "When Deep completes" },
          },
        ],
        events: { done: "When B completes" },
      },
      {
        key: "B",
        transitions: [
          ["", "*", "C"],
          ["C", "done", ""],
        ],
        events: { done: "When C completes" },
      },
      { key: "C", events: { done: "Root's C, used by nobody at runtime" } },
    ],
  };

  it("does not report the C the runtime actually enters as unreachable", () => {
    const result = validate(shadowedThroughCaller, { rules: ["S4"] });
    const messages = result.errors.map((e) => `${e.path.join("/")}: ${e.message}`);
    expect(messages.filter((m) => m.startsWith("Root/A:"))).toEqual([]);
  });

  it("reports the shadowed outer C as unreachable, since no instantiation resolves to it", () => {
    const result = validate(shadowedThroughCaller, { rules: ["S4"] });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toEqual(["Root"]);
    expect(result.errors[0].message).toContain('"C"');
  });

  it("checks the exit events of the C the runtime enters against the scope entering it (S6)", () => {
    const config = structuredClone(shadowedThroughCaller);
    // B no longer handles "done" from C: the C it enters (A's) exits with it.
    const b = config.states?.find((s) => s.key === "B");
    if (!b) throw new Error("fixture");
    b.transitions = [
      ["", "*", "C"],
      ["C", "other", ""],
    ];
    const result = validate(config, { rules: ["S6"] });
    const s6 = result.errors.filter((e) => e.message.includes('Child "C"'));
    expect(s6.length).toBeGreaterThan(0);
    expect(s6[0].message).toContain('parent "B"');
    // Reported where B is entered at runtime: Root/A/B.
    expect(s6[0].path).toEqual(["Root", "A", "B"]);
  });

  it("reports a key that resolves in one instantiation but not in another", () => {
    // B is entered from X (which defines C) and from Y (which does not).
    const config: FsmStateConfig = {
      key: "Root",
      transitions: [
        ["", "*", "X"],
        ["X", "done", "Y"],
        ["Y", "done", ""],
      ],
      states: [
        {
          key: "X",
          transitions: [
            ["", "*", "B"],
            ["B", "done", ""],
          ],
          states: [{ key: "C", events: { done: "When C completes" } }],
          events: { done: "When B completes" },
        },
        {
          key: "Y",
          transitions: [
            ["", "*", "B"],
            ["B", "done", ""],
          ],
          events: { done: "When B completes" },
        },
        {
          key: "B",
          transitions: [
            ["", "*", "C"],
            ["C", "done", ""],
          ],
          events: { done: "When C completes" },
        },
      ],
    };
    const result = validate(config, { rules: ["S2"] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of result.errors) {
      expect(e.rule).toBe("S2");
      expect(e.path).toEqual(["Root", "Y", "B"]);
      expect(e.message).toContain('"C"');
    }
  });

  it("terminates on a definition that enters itself recursively", () => {
    const config: FsmStateConfig = {
      key: "Root",
      transitions: [
        ["", "*", "Loop"],
        ["Loop", "done", ""],
      ],
      states: [
        {
          key: "Loop",
          transitions: [
            ["", "*", "Loop"],
            ["Loop", "done", ""],
          ],
          events: { done: "When it completes" },
        },
      ],
    };
    const result = validate(config, { rules: ["S1", "S2", "S4", "S6", "M1", "M3"] });
    expect(result.errors).toEqual([]);
  });

  it("follows a recursive entry far enough to see keys only the deeper chain defines", () => {
    // Root/A enters M; M enters A again; that inner A's Y resolves through M
    // to M's own Y (the runtime enters Root/A/M/A/Y/MyChild), so M's Y is
    // reachable, not dead.
    const config: FsmStateConfig = {
      key: "Root",
      transitions: [
        ["", "*", "A"],
        ["A", "done", ""],
      ],
      states: [
        {
          key: "A",
          transitions: [
            ["", "*", "Y"],
            ["Y", "go", "M"],
            ["M", "done", ""],
          ],
          events: { done: "When M completes" },
        },
        {
          key: "M",
          transitions: [
            ["", "*", "A"],
            ["A", "done", ""],
          ],
          states: [
            {
              key: "Y",
              transitions: [["", "*", "MyChild"]],
              states: [{ key: "MyChild", events: { go: "Go on" } }],
              events: { go: "Go on" },
            },
          ],
          events: { done: "When A completes" },
        },
        { key: "Y", events: { go: "Go on" } },
      ],
    };
    const result = validate(config, { rules: ["S2", "S4"] });
    expect(result.errors).toEqual([]);
  });
});
