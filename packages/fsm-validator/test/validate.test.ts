import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import {
  coffeeMachine,
  documentReview,
  lightBulb,
  ticketFlow,
} from "./fixtures.ts";

describe("validate() integration", () => {
  // ── Full validation on valid configs ───────────────────────────────────

  describe("valid configurations", () => {
    it("should produce no errors for lightBulb", () => {
      const result = validate(lightBulb);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should produce no errors for ticketFlow", () => {
      const result = validate(ticketFlow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should produce no errors for coffeeMachine", () => {
      const result = validate(coffeeMachine);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should produce no errors for documentReview", () => {
      const result = validate(documentReview);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── Full validation on invalid configs ────────────────────────────────

  describe("invalid configurations", () => {
    it("should catch multiple errors in a broken config", () => {
      const config: FsmStateConfig = {
        key: "Broken",
        transitions: [
          ["A", "go", "NonExistent"],
          ["also wrong"] as unknown as [string, string, string],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig, // duplicate
        ],
      };
      const result = validate(config);
      expect(result.valid).toBe(false);
      // Should catch: L3 (bad tuple), L7 (duplicate), S1 (no initial), S2 (dangling ref)
      const ruleIds = new Set(result.errors.map((e) => e.rule));
      expect(ruleIds.has("L3")).toBe(true);
      expect(ruleIds.has("L7")).toBe(true);
      expect(ruleIds.has("S1")).toBe(true);
    });

    it("should catch missing key at nested level", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          {
            key: "A",
            transitions: [["", "*", "B"]],
            states: [{ key: "" } as FsmStateConfig],
          },
        ],
      };
      const result = validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "L1")).toBe(true);
    });
  });

  // ── ValidationOptions filtering ───────────────────────────────────────

  describe("options.rules filtering", () => {
    it("should only run specified rules", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["A", "go", "NonExistent"],
          ["bad tuple"] as unknown as [string, string, string],
        ],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["L3"] });
      // Only L3 should fire
      expect(result.errors.every((e) => e.rule === "L3")).toBe(true);
    });

    it("should return valid when only info-level issues are produced", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      const result = validate(config, { rules: ["M7"] });
      expect(result.valid).toBe(true);
    });
  });

  describe("options.exclude filtering", () => {
    it("should exclude specified rules", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["bad tuple"] as unknown as [string, string, string]],
        states: [{ key: "A" } as FsmStateConfig],
      };
      // With L3 included
      const withL3 = validate(config);
      expect(withL3.errors.some((e) => e.rule === "L3")).toBe(true);

      // With L3 excluded
      const withoutL3 = validate(config, { exclude: ["L3"] });
      expect(withoutL3.errors.every((e) => e.rule !== "L3")).toBe(true);
    });
  });

  // ── Result structure ──────────────────────────────────────────────────

  describe("result structure", () => {
    it("should have correct structure for valid config", () => {
      const result = validate(lightBulb);
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("review");
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.review)).toBe(true);
    });

    it("should have issues = errors + warnings + info + review", () => {
      const result = validate(lightBulb);
      const infoCount = result.issues.filter(
        (i) => i.severity === "info",
      ).length;
      expect(result.issues.length).toBe(
        result.errors.length +
          result.warnings.length +
          result.review.length +
          infoCount,
      );
    });

    it("should include path in issues", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Child"]],
        states: [
          {
            key: "Child",
            transitions: [["", "*", "Nested"]],
            states: [{ key: "Nested" } as FsmStateConfig],
          },
        ],
      };
      const result = validate(config, { rules: ["S8"] });
      const nestedIssues = result.issues.filter((i) =>
        i.path.includes("Child"),
      );
      expect(nestedIssues.length).toBeGreaterThan(0);
    });

    it("valid is true when only warnings present, no errors", () => {
      const config: FsmStateConfig = {
        key: "UPPER_CASE",
        transitions: [
          ["", "*", "A"],
          ["A", "Bad_Event", "B"],
        ],
        states: [
          { key: "A", events: {} },
          { key: "B", events: {} },
        ],
      };
      const result = validate(config, { rules: ["L2", "L5"] });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("valid is true when only review issues present, no errors", () => {
      const config: FsmStateConfig = {
        key: "Root",
        description: "Main process",
        transitions: [["", "*", "Step"]],
        states: [
          {
            key: "Step",
            description: "A step",
            events: { done: "When complete" },
          },
        ],
      };
      const result = validate(config, { rules: ["M8", "M9"] });
      expect(result.valid).toBe(true);
      expect(result.review.length).toBeGreaterThan(0);
    });
  });

  // ── Minimal config ────────────────────────────────────────────────────

  describe("minimal config", () => {
    it("should validate a single leaf state with no issues beyond info/review", () => {
      const config: FsmStateConfig = { key: "Single" };
      const result = validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
