import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import {
  coffeeMachine,
  documentReview,
  lightBulb,
  ticketFlow,
} from "./fixtures.ts";

describe("Structural rules", () => {
  // ── S1: initial transition required for composite states ──────────────

  describe("S1: initial transition required", () => {
    it("should pass for composite state with initial transition", () => {
      const result = validate(lightBulb, { rules: ["S1"] });
      expect(result.valid).toBe(true);
    });

    it("should report error when composite state has no transitions at all", () => {
      const config: FsmStateConfig = {
        key: "Root",
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe("S1");
      expect(result.errors[0].message).toContain("no transitions");
    });

    it("should report error when composite state has transitions but no initial", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "go", "B"]],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("initial transition");
    });

    it("should pass when initial transition targets a valid child", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(true);
    });

    it("should report error when initial transition targets non-existent child", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "NonExistent"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(false);
    });

    it("should pass for leaf state without initial transition", () => {
      const config: FsmStateConfig = { key: "Leaf" };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(true);
    });

    it("should validate nested composite states", () => {
      const result = validate(coffeeMachine, { rules: ["S1"] });
      expect(result.valid).toBe(true);
    });

    it("should accept initial with specific event (not just '*')", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "start", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S1"] });
      expect(result.valid).toBe(true);
    });
  });

  // ── S2: transitions reference only siblings ───────────────────────────

  describe("S2: transitions reference only siblings", () => {
    it("should pass when all refs are valid siblings", () => {
      const result = validate(lightBulb, { rules: ["S2"] });
      expect(result.valid).toBe(true);
    });

    it("should report error for transition to non-existent state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "NonExistent"],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("NonExistent");
    });

    it("should report error for transition from non-existent state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["NonExistent", "go", "A"],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("NonExistent");
    });

    it("should allow empty string and wildcard refs", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "err", "A"],
          ["A", "done", ""],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(true);
    });

    it("should skip check for states without children", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "go", "B"]],
      };
      // No states array → no siblings to check against → no errors
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(true);
    });

    it("should validate nested state transitions", () => {
      const result = validate(ticketFlow, { rules: ["S2"] });
      expect(result.valid).toBe(true);
    });

    it("should report multiple errors for multiple dangling refs", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["X", "go", "Y"],
          ["A", "go", "Z"],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── S3: sibling transitions at parent level ───────────────────────────

  describe("S3: sibling transitions at parent level", () => {
    it("should return no issues (advisory, not enforced)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        states: [
          {
            key: "A",
            transitions: [["A", "go", "B"]],
          } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S3"] });
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── S4: reachability from initial transition ──────────────────────────

  describe("S4: reachability from initial transition", () => {
    it("should pass when all states are reachable", () => {
      const result = validate(lightBulb, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for unreachable state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("S4");
      expect(result.warnings[0].message).toContain("B");
    });

    it("should handle wildcard source transitions (makes all states reachable)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "reset", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle chains of transitions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "go", "C"],
          ["C", "go", "D"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
          { key: "D" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should detect island state disconnected from main graph", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["C", "go", "D"], // C and D form an island
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
          { key: "D" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      const unreachableKeys = result.warnings.map(
        (w) => w.message.match(/"([^"]+)"/)?.[1],
      );
      expect(unreachableKeys).toContain("C");
    });

    it("should pass for leaf states (no children to check)", () => {
      const config: FsmStateConfig = { key: "Leaf" };
      const result = validate(config, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should validate nested hierarchy reachability", () => {
      const result = validate(coffeeMachine, { rules: ["S4"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── S5: no dead-ends ──────────────────────────────────────────────────

  describe("S5: no dead-ends", () => {
    it("should pass when all states have outgoing transitions", () => {
      const result = validate(lightBulb, { rules: ["S5"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should pass when wildcard source covers all states", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "reset", "A"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S5"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for composite dead-end state", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          {
            key: "B",
            transitions: [["", "*", "Sub"]],
            states: [{ key: "Sub" } as FsmStateConfig],
          },
        ],
      };
      const result = validate(config, { rules: ["S5"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("B");
    });

    it("should pass for leaf states without outgoing (may be intentionally final)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig, // leaf, no outgoing
        ],
      };
      const result = validate(config, { rules: ["S5"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── S6: exit event propagation ────────────────────────────────────────

  describe("S6: exit event propagation", () => {
    it("should pass when parent handles all exit events", () => {
      const result = validate(ticketFlow, { rules: ["S6"] });
      expect(result.issues.filter((i) => i.rule === "S6")).toHaveLength(0);
    });

    it("should report info when parent does not handle exit event", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Child"]],
        states: [
          {
            key: "Child",
            transitions: [
              ["", "*", "Sub"],
              ["Sub", "done", ""],
            ],
            states: [{ key: "Sub", events: ["done"] }],
          },
        ],
      };
      const result = validate(config, { rules: ["S6"] });
      const s6Issues = result.issues.filter((i) => i.rule === "S6");
      expect(s6Issues).toHaveLength(1);
      expect(s6Issues[0].severity).toBe("info");
      expect(s6Issues[0].message).toContain("done");
    });

    it("should pass when parent handles with wildcard event", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "Child"],
          ["Child", "*", "Other"],
        ],
        states: [
          {
            key: "Child",
            transitions: [
              ["", "*", "Sub"],
              ["Sub", "finished", ""],
            ],
            states: [{ key: "Sub", events: ["finished"] }],
          },
          { key: "Other" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S6"] });
      expect(result.issues.filter((i) => i.rule === "S6")).toHaveLength(0);
    });

    it("should pass when parent handles with wildcard source", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "Child"],
          ["*", "done", "Other"],
        ],
        states: [
          {
            key: "Child",
            transitions: [
              ["", "*", "Sub"],
              ["Sub", "done", ""],
            ],
            states: [{ key: "Sub", events: ["done"] }],
          },
          { key: "Other" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S6"] });
      expect(result.issues.filter((i) => i.rule === "S6")).toHaveLength(0);
    });
  });

  // ── S7: determinism with wildcards ────────────────────────────────────

  describe("S7: determinism with wildcards", () => {
    it("should pass for non-ambiguous transitions", () => {
      const result = validate(lightBulb, { rules: ["S7"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for duplicate (from, event) with different targets", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["A", "go", "C"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "C" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S7"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("S7");
      expect(result.warnings[0].message).toContain("Ambiguous");
    });

    it("should pass when same (from, event) goes to same target", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["A", "go", "B"], // duplicate but same target
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S7"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for conflicting wildcard transitions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "error", "ErrA"],
          ["*", "error", "ErrB"],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "ErrA" } as FsmStateConfig,
          { key: "ErrB" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["S7"] });
      expect(result.warnings).toHaveLength(1);
    });
  });

  // ── S8: no cross-level jumps ──────────────────────────────────────────

  describe("S8: no cross-level jumps", () => {
    it("should return no issues (subsumed by S2)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S8"] });
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── S9: leaf states declare events ────────────────────────────────────

  describe("S9: leaf states declare events", () => {
    it("should pass for leaf state with events", () => {
      const result = validate(lightBulb, { rules: ["S9"] });
      expect(result.issues.filter((i) => i.rule === "S9")).toHaveLength(0);
    });

    it("should report info for leaf state without events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["S9"] });
      const s9Issues = result.issues.filter((i) => i.rule === "S9");
      expect(s9Issues).toHaveLength(1);
      expect(s9Issues[0].severity).toBe("info");
      expect(s9Issues[0].message).toContain("A");
    });

    it("should not report for root state without events", () => {
      const config: FsmStateConfig = { key: "Root" };
      const result = validate(config, { rules: ["S9"] });
      expect(result.issues.filter((i) => i.rule === "S9")).toHaveLength(0);
    });

    it("should not report for composite states", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Composite"]],
        states: [
          {
            key: "Composite",
            transitions: [["", "*", "Sub"]],
            states: [{ key: "Sub", events: ["done"] }],
          },
        ],
      };
      const result = validate(config, { rules: ["S9"] });
      expect(result.issues.filter((i) => i.rule === "S9")).toHaveLength(0);
    });

    it("should report for multiple leaf states without events", () => {
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
      const result = validate(config, { rules: ["S9"] });
      const s9Issues = result.issues.filter((i) => i.rule === "S9");
      expect(s9Issues).toHaveLength(2);
    });
  });

  // ── Cross-validation with real fixtures ───────────────────────────────

  describe("All structural rules on valid fixtures", () => {
    it("should produce no errors for lightBulb", () => {
      const result = validate(lightBulb, {
        rules: ["S1", "S2", "S4", "S5", "S7"],
      });
      expect(result.valid).toBe(true);
    });

    it("should produce no errors for ticketFlow", () => {
      const result = validate(ticketFlow, {
        rules: ["S1", "S2", "S4", "S5", "S7"],
      });
      expect(result.valid).toBe(true);
    });

    it("should produce no errors for coffeeMachine", () => {
      const result = validate(coffeeMachine, {
        rules: ["S1", "S2", "S4", "S5", "S7"],
      });
      expect(result.valid).toBe(true);
    });

    it("should produce no errors for documentReview", () => {
      const result = validate(documentReview, {
        rules: ["S1", "S2", "S4", "S5", "S7"],
      });
      expect(result.valid).toBe(true);
    });
  });
});
