import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import { lightBulb } from "./fixtures.ts";

describe("Lexical rules", () => {
  // ── L1: key is mandatory ──────────────────────────────────────────────

  describe("L1: key is mandatory", () => {
    it("should report error for empty key", () => {
      const config = { key: "" } as FsmStateConfig;
      const result = validate(config, { rules: ["L1"] });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rule).toBe("L1");
    });

    it("should report error for missing key (undefined)", () => {
      const config = {} as FsmStateConfig;
      const result = validate(config, { rules: ["L1"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe("L1");
    });

    it("should pass for valid key", () => {
      const result = validate({ key: "Valid" } as FsmStateConfig, {
        rules: ["L1"],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should check nested state keys", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["L1"] });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ── L2: state key format ──────────────────────────────────────────────

  describe("L2: state key format", () => {
    it("should pass for PascalCase keys", () => {
      const config: FsmStateConfig = { key: "ProcessingOrder" };
      const result = validate(config, { rules: ["L2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should pass for simple uppercase keys like 'On', 'Off'", () => {
      const result = validate(lightBulb, { rules: ["L2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for UPPER_SNAKE_CASE keys", () => {
      const config: FsmStateConfig = { key: "MAIN_VIEW" };
      const result = validate(config, { rules: ["L2"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("L2");
      expect(result.warnings[0].message).toContain("MAIN_VIEW");
    });

    it("should not warn for keys that fail STATE_KEY_PATTERN entirely (L1/L5 handles that)", () => {
      // Keys like "123" don't match STATE_KEY_PATTERN, so L2 silently skips them
      const config: FsmStateConfig = { key: "123invalid" };
      const result = validate(config, { rules: ["L2"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for nested non-PascalCase keys", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "CHILD_STATE"]],
        states: [{ key: "CHILD_STATE", events: [] }],
      };
      const result = validate(config, { rules: ["L2"] });
      // Root is fine, CHILD_STATE gets a warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("CHILD_STATE");
    });
  });

  // ── L3: event name format ─────────────────────────────────────────────

  describe("L3: event name format", () => {
    it("should pass for camelCase events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "toggle", "B"],
          ["B", "dataLoaded", "A"],
        ],
        states: [
          { key: "A", events: [] },
          { key: "B", events: [] },
        ],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should pass for wildcard event '*'", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A", events: [] }],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for PascalCase event names", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "Toggle", "B"]],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("L3");
      expect(result.warnings[0].message).toContain("Toggle");
    });

    it("should warn for snake_case event names", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "data_loaded", "B"]],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("data_loaded");
    });

    it("should report multiple warnings for multiple bad events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["A", "Bad_Event", "B"],
          ["B", "ALSO_BAD", "A"],
        ],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(2);
    });

    it("should skip malformed transitions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "B"] as unknown as [string, string, string]],
      };
      const result = validate(config, { rules: ["L3"] });
      expect(result.warnings).toHaveLength(0); // skips because length !== 3
    });
  });

  // ── L4: transition tuple length ───────────────────────────────────────

  describe("L4: transition tuple length", () => {
    it("should pass for 3-element arrays", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "evt", "B"]],
      };
      const result = validate(config, { rules: ["L4"] });
      expect(result.valid).toBe(true);
    });

    it("should report error for 2-element array", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "B"] as unknown as [string, string, string]],
      };
      const result = validate(config, { rules: ["L4"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe("L4");
      expect(result.errors[0].message).toContain("2 elements");
    });

    it("should report error for 4-element array", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["A", "evt", "B", "extra"] as unknown as [string, string, string],
        ],
      };
      const result = validate(config, { rules: ["L4"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("4 elements");
    });

    it("should report error for non-array transition", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: ["not-an-array" as unknown as [string, string, string]],
      };
      const result = validate(config, { rules: ["L4"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("string");
    });

    it("should pass when no transitions", () => {
      const config: FsmStateConfig = { key: "Root" };
      const result = validate(config, { rules: ["L4"] });
      expect(result.valid).toBe(true);
    });

    it("should report multiple errors for multiple bad transitions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["A"] as unknown as [string, string, string],
          ["A", "evt", "B"],
          ["C", "D"] as unknown as [string, string, string],
        ],
      };
      const result = validate(config, { rules: ["L4"] });
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toContain("index 0");
      expect(result.errors[1].message).toContain("index 2");
    });
  });

  // ── L5: state reference format ────────────────────────────────────────

  describe("L5: state reference format", () => {
    it("should pass for valid state refs (PascalCase, empty, wildcard)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "StateA"],
          ["StateA", "go", "StateB"],
          ["*", "err", "ErrorState"],
          ["StateB", "done", ""],
        ],
      };
      const result = validate(config, { rules: ["L5"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for numeric state refs", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["123", "go", "456"]],
      };
      const result = validate(config, { rules: ["L5"] });
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.every((w) => w.rule === "L5")).toBe(true);
    });

    it("should warn for state refs with spaces", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["Some State", "go", "Another State"]],
      };
      const result = validate(config, { rules: ["L5"] });
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── L6: event reference format ────────────────────────────────────────

  describe("L6: event reference format", () => {
    it("should pass for camelCase events and wildcard", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["A", "*", "B"],
          ["B", "eventName", "A"],
        ],
      };
      const result = validate(config, { rules: ["L6"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for PascalCase events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "BadEvent", "B"]],
      };
      const result = validate(config, { rules: ["L6"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("L6");
    });

    it("should pass for empty event (initial transition)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "", "Init"]],
      };
      const result = validate(config, { rules: ["L6"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── L7: events array format ───────────────────────────────────────────

  describe("L7: events array format", () => {
    it("should pass for camelCase events in array", () => {
      const config: FsmStateConfig = {
        key: "State",
        events: ["success", "failure", "dataLoaded"],
      };
      const result = validate(config, { rules: ["L7"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn for PascalCase events in array", () => {
      const config: FsmStateConfig = {
        key: "State",
        events: ["Success", "failure"],
      };
      const result = validate(config, { rules: ["L7"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("Success");
    });

    it("should warn for snake_case events in array", () => {
      const config: FsmStateConfig = {
        key: "State",
        events: ["data_loaded"],
      };
      const result = validate(config, { rules: ["L7"] });
      expect(result.warnings).toHaveLength(1);
    });

    it("should pass when no events array", () => {
      const config: FsmStateConfig = { key: "State" };
      const result = validate(config, { rules: ["L7"] });
      expect(result.warnings).toHaveLength(0);
    });

    it("should pass for empty events array", () => {
      const config: FsmStateConfig = { key: "State", events: [] };
      const result = validate(config, { rules: ["L7"] });
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── L8: no duplicate sibling keys ─────────────────────────────────────

  describe("L8: no duplicate sibling keys", () => {
    it("should pass for unique sibling keys", () => {
      const result = validate(lightBulb, { rules: ["L8"] });
      expect(result.valid).toBe(true);
    });

    it("should report error for duplicate sibling keys", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["L8"] });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rule).toBe("L8");
      expect(result.errors[0].message).toContain("A");
    });

    it("should report multiple errors for multiple duplicates", () => {
      const config: FsmStateConfig = {
        key: "Root",
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["L8"] });
      expect(result.errors).toHaveLength(2);
    });

    it("should pass when no states", () => {
      const config: FsmStateConfig = { key: "Root" };
      const result = validate(config, { rules: ["L8"] });
      expect(result.valid).toBe(true);
    });

    it("should allow same key at different hierarchy levels", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          {
            key: "A",
            transitions: [["", "*", "B"]],
            states: [{ key: "B" } as FsmStateConfig],
          },
          { key: "B" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["L8"] });
      expect(result.valid).toBe(true);
    });
  });
});
