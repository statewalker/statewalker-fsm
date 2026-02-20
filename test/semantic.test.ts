import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import { documentReview, lightBulb, ticketFlow } from "./fixtures.ts";

describe("Semantic rules", () => {
  // ── M1: forward event coverage (events → transitions) ────────────────

  describe("M1: forward event coverage", () => {
    it("should pass when all events have matching transitions", () => {
      const result = validate(lightBulb, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for event with no matching transition in parent", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A", events: ["go", "orphanEvent"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("orphanEvent");
    });

    it("should pass when wildcard event covers all events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "*", "B"],
        ],
        states: [
          { key: "A", events: ["anything", "whatever"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should pass when wildcard source covers the state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "error", "Error"],
        ],
        states: [
          { key: "A", events: ["error"] },
          { key: "Error", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should skip states without events array", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should skip root state (no parent)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        events: ["someEvent"],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should validate nested event coverage", () => {
      const result = validate(ticketFlow, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for multiple uncovered events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A", events: ["eventA", "eventB", "eventC"] }],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(3);
    });
  });

  // ── M2: reverse event coverage (transitions → events) ────────────────

  describe("M2: reverse event coverage", () => {
    it("should pass when all transition events are declared in source events", () => {
      const result = validate(lightBulb, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for transition event not in source's events[]", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "undeclared", "B"],
        ],
        states: [
          { key: "A", events: ["declared"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("undeclared");
    });

    it("should skip wildcard events in transitions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "*", "B"],
        ],
        states: [
          { key: "A", events: ["go"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should skip transitions from '' or '*'", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "error", "Err"],
        ],
        states: [
          { key: "A", events: ["go"] },
          { key: "Err", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should skip validation if no child declares events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should only check states that have events declared", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "undeclared", "B"],
          ["B", "nope", "A"],
        ],
        states: [
          { key: "A", events: ["declared"] }, // has events → "undeclared" is flagged
          { key: "B" } as FsmStateConfig, // no events → "nope" is not checked
        ],
      };
      const result = validate(config, { rules: ["M2"] });
      expect(result.warnings).toHaveLength(1);
    });
  });

  // ── M3: hierarchical event declaration ────────────────────────────────

  describe("M3: hierarchical event declaration", () => {
    it("should return no issues for well-structured hierarchy", () => {
      const result = validate(ticketFlow, { rules: ["M3"] });
      expect(result.issues.filter((i) => i.rule === "M3")).toHaveLength(0);
    });

    it("should return no issues for leaf states", () => {
      const config: FsmStateConfig = {
        key: "Root",
        events: ["done"],
      };
      const result = validate(config, { rules: ["M3"] });
      expect(result.issues.filter((i) => i.rule === "M3")).toHaveLength(0);
    });
  });

  // ── M4: semantic compatibility ────────────────────────────────────────

  describe("M4: semantic compatibility", () => {
    it("should report info for convergent transitions from same source", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "ok", "B"],
          ["A", "error", "B"], // same source, different events, same target
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["M4"] });
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe("info");
      expect(result.issues[0].message).toContain("ok");
      expect(result.issues[0].message).toContain("error");
      expect(result.issues[0].message).toContain("semantically compatible");
    });

    it("should not report for different sources converging to same target", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "ok", "C"],
          ["B", "ok", "C"], // different sources, same target — normal
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["M4"] });
      expect(result.issues).toHaveLength(0);
    });

    it("should not report for single transition to a target", () => {
      const result = validate(lightBulb, { rules: ["M4"] });
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── M5: cycle break requirement ───────────────────────────────────────

  describe("M5: cycle break requirement", () => {
    // Helper: wraps a state config inside a parent so M5 does not skip it
    // (M5 skips root-level cycles since machine exit is external)
    function wrapInParent(child: FsmStateConfig): FsmStateConfig {
      return {
        key: "Wrapper",
        transitions: [["", "*", child.key]],
        states: [child],
      };
    }

    it("should pass for cycle with exit transition", () => {
      const result = validate(wrapInParent(documentReview), { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should skip cycle check at root level (exit is external)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "A"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should warn for cycle without exit in nested state", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "A"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      const m5 = result.warnings.filter((w) => w.rule === "M5");
      expect(m5).toHaveLength(1);
      expect(m5[0].message).toContain("Cycle");
    });

    it("should pass for cycle with exit to empty string", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "A"],
          ["B", "done", ""],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should pass for cycle with exit to non-cycle state", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "A"],
          ["B", "done", "C"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
        ],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should warn for self-loop without exit in nested state", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "retry", "A"],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      const m5 = result.warnings.filter((w) => w.rule === "M5");
      expect(m5).toHaveLength(1);
      expect(m5[0].message).toContain("Cycle");
    });

    it("should pass for self-loop with exit", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "retry", "A"],
          ["A", "done", ""],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should pass for acyclic graph", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "C"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
        ],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      expect(result.warnings.filter((w) => w.rule === "M5")).toHaveLength(0);
    });

    it("should handle three-state cycle", () => {
      const child: FsmStateConfig = {
        key: "Inner",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "C"],
          ["C", "go", "A"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
        ],
      };
      const result = validate(wrapInParent(child), { rules: ["M5"] });
      const m5 = result.warnings.filter((w) => w.rule === "M5");
      expect(m5).toHaveLength(1);
      expect(m5[0].message).toContain("A");
      expect(m5[0].message).toContain("B");
      expect(m5[0].message).toContain("C");
    });

    it("should pass when no transitions", () => {
      const config: FsmStateConfig = { key: "Root" };
      const result = validate(config, { rules: ["M5"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── M6: decision point exhaustiveness ─────────────────────────────────

  describe("M6: decision point exhaustiveness", () => {
    it("should pass when all declared events have transitions", () => {
      const result = validate(lightBulb, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn when declared event has no transition", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "success", "B"],
        ],
        states: [
          { key: "A", events: ["success", "failure"] }, // failure has no transition
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("failure");
    });

    it("should pass when wildcard event covers everything", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "*", "B"],
        ],
        states: [
          { key: "A", events: ["anything", "whatever"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should skip states without events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for multiple uncovered events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "success", "B"],
        ],
        states: [
          { key: "A", events: ["success", "failure", "timeout"] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(1);
      const msg = result.warnings[0].message;
      expect(msg).toContain("failure");
      expect(msg).toContain("timeout");
    });

    it("should validate exhaustiveness in nested hierarchy", () => {
      const result = validate(documentReview, { rules: ["M6"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── M7: manageable complexity ─────────────────────────────────────────

  describe("M7: manageable complexity", () => {
    it("should pass for 2-7 sub-states", () => {
      const result = validate(lightBulb, { rules: ["M7"] });
      expect(result.issues.filter((i) => i.rule === "M7")).toHaveLength(0);
    });

    it("should report info for 1 sub-state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Only"]],
        states: [{ key: "Only" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["M7"] });
      const m7Issues = result.issues.filter((i) => i.rule === "M7");
      expect(m7Issues).toHaveLength(1);
      expect(m7Issues[0].severity).toBe("info");
      expect(m7Issues[0].message).toContain("1 sub-state");
    });

    it("should report info for more than 7 sub-states", () => {
      const states = Array.from({ length: 8 }, (_, i) => ({
        key: `State${String.fromCharCode(65 + i)}`,
      })) as FsmStateConfig[];
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "StateA"]],
        states,
      };
      const result = validate(config, { rules: ["M7"] });
      const m7Issues = result.issues.filter((i) => i.rule === "M7");
      expect(m7Issues).toHaveLength(1);
      expect(m7Issues[0].message).toContain("8 sub-states");
      expect(m7Issues[0].message).toContain("decomposing");
    });

    it("should pass for no sub-states (leaf node)", () => {
      const config: FsmStateConfig = { key: "Leaf" };
      const result = validate(config, { rules: ["M7"] });
      expect(result.issues.filter((i) => i.rule === "M7")).toHaveLength(0);
    });

    it("should pass for exactly 7 sub-states", () => {
      const states = Array.from({ length: 7 }, (_, i) => ({
        key: `S${i}`,
      })) as FsmStateConfig[];
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "S0"]],
        states,
      };
      const result = validate(config, { rules: ["M7"] });
      expect(result.issues.filter((i) => i.rule === "M7")).toHaveLength(0);
    });
  });

  // ── Cross-validation with real fixtures ───────────────────────────────

  describe("All semantic rules on valid fixtures", () => {
    it("should produce no warnings for lightBulb", () => {
      const result = validate(lightBulb, {
        rules: ["M1", "M2", "M5", "M6"],
      });
      expect(result.warnings).toHaveLength(0);
    });

    it("should produce no warnings for documentReview", () => {
      const result = validate(documentReview, {
        rules: ["M1", "M2", "M5", "M6"],
      });
      expect(result.warnings).toHaveLength(0);
    });
  });
});
