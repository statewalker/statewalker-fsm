import type { ValidationIssue, ValidationResult } from "../src/types.ts";
import { buildReport, formatReport } from "../src/report.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import { coffeeMachine, lightBulb } from "./fixtures.ts";
import type { FsmStateConfig } from "../src/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeResult(
  issues: ValidationIssue[],
  valid?: boolean,
): ValidationResult {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const review = issues.filter((i) => i.severity === "review");
  return {
    valid: valid ?? errors.length === 0,
    issues,
    errors,
    warnings,
    review,
  };
}

const emptyResult = makeResult([]);

// ── buildReport() ────────────────────────────────────────────────────────

describe("buildReport()", () => {
  it("should return empty categories for no issues", () => {
    const report = buildReport(emptyResult);
    expect(report.categories).toHaveLength(0);
    expect(report.valid).toBe(true);
    expect(report.summary).toEqual({
      total: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      review: 0,
    });
  });

  it("should produce a single Lexical category for one L1 error", () => {
    const result = makeResult([
      {
        rule: "L1",
        severity: "error",
        message: "State key is empty",
        path: [],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Lexical Issues");
    expect(report.categories[0].rules).toHaveLength(1);
    expect(report.categories[0].rules[0].rule).toBe("L1");
    expect(report.categories[0].rules[0].severity).toBe("error");
    expect(report.categories[0].rules[0].entries).toHaveLength(1);
  });

  it("should group multiple issues under the same rule", () => {
    const result = makeResult([
      {
        rule: "L2",
        severity: "warning",
        message: 'Key "UPPER" is not PascalCase',
        path: ["Root"],
      },
      {
        rule: "L2",
        severity: "warning",
        message: 'Key "lower" is not PascalCase',
        path: ["Root", "Parent"],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].rules).toHaveLength(1);
    expect(report.categories[0].rules[0].entries).toHaveLength(2);
  });

  it("should group multiple rules in the same category", () => {
    const result = makeResult([
      {
        rule: "L2",
        severity: "warning",
        message: "bad key",
        path: ["Root"],
      },
      {
        rule: "L3",
        severity: "error",
        message: "bad transition",
        path: ["Root"],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Lexical Issues");
    expect(report.categories[0].rules).toHaveLength(2);
    expect(report.categories[0].rules[0].rule).toBe("L2");
    expect(report.categories[0].rules[1].rule).toBe("L3");
  });

  it("should produce all three categories when issues span L, S, M", () => {
    const result = makeResult([
      {
        rule: "L1",
        severity: "error",
        message: "lex issue",
        path: [],
      },
      {
        rule: "S1",
        severity: "error",
        message: "struct issue",
        path: [],
      },
      {
        rule: "M1",
        severity: "warning",
        message: "sem issue",
        path: [],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories).toHaveLength(3);
    expect(report.categories[0].category).toBe("Lexical Issues");
    expect(report.categories[1].category).toBe("Structural Issues");
    expect(report.categories[2].category).toBe("Semantic Issues");
  });

  it("should only include categories that have issues", () => {
    const result = makeResult([
      {
        rule: "S2",
        severity: "error",
        message: "dangling ref",
        path: ["Root"],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Structural Issues");
  });

  it("should format nested path as 'A > B > C'", () => {
    const result = makeResult([
      {
        rule: "L2",
        severity: "warning",
        message: "bad key",
        path: ["Root", "Handle", "Diagnose"],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories[0].rules[0].entries[0].path).toBe(
      "Root > Handle > Diagnose",
    );
  });

  it("should format empty path as '(root)'", () => {
    const result = makeResult([
      {
        rule: "L1",
        severity: "error",
        message: "no key",
        path: [],
      },
    ]);
    const report = buildReport(result);
    expect(report.categories[0].rules[0].entries[0].path).toBe("(root)");
  });

  it("should compute summary counts correctly", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e1", path: [] },
      { rule: "L3", severity: "error", message: "e2", path: [] },
      { rule: "L2", severity: "warning", message: "w1", path: [] },
      { rule: "M7", severity: "info", message: "i1", path: [] },
      { rule: "M8", severity: "review", message: "s1", path: [] },
      { rule: "M9", severity: "review", message: "s2", path: [] },
    ]);
    const report = buildReport(result);
    expect(report.summary).toEqual({
      total: 6,
      errors: 2,
      warnings: 1,
      info: 1,
      review: 2,
    });
  });

  it("should mirror the valid flag from input", () => {
    const validResult = makeResult([], true);
    expect(buildReport(validResult).valid).toBe(true);

    const invalidResult = makeResult(
      [{ rule: "L1", severity: "error", message: "err", path: [] }],
      false,
    );
    expect(buildReport(invalidResult).valid).toBe(false);
  });

  it("should order categories as Lexical, Structural, Semantic", () => {
    const result = makeResult([
      { rule: "M1", severity: "warning", message: "m", path: [] },
      { rule: "L1", severity: "error", message: "l", path: [] },
      { rule: "S1", severity: "error", message: "s", path: [] },
    ]);
    const report = buildReport(result);
    const names = report.categories.map((c) => c.category);
    expect(names).toEqual([
      "Lexical Issues",
      "Structural Issues",
      "Semantic Issues",
    ]);
  });

  it("should order rules within a category by rule ID", () => {
    const result = makeResult([
      { rule: "L7", severity: "error", message: "l7", path: [] },
      { rule: "L2", severity: "warning", message: "l2", path: [] },
      { rule: "L3", severity: "error", message: "l3", path: [] },
    ]);
    const report = buildReport(result);
    const ruleIds = report.categories[0].rules.map((r) => r.rule);
    expect(ruleIds).toEqual(["L2", "L3", "L7"]);
  });

  it("should preserve rule description from ruleDefinitions", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result);
    expect(report.categories[0].rules[0].description).toBe("key is mandatory");
  });

  it("should handle single-element path", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "bad", path: ["Root"] },
    ]);
    const report = buildReport(result);
    expect(report.categories[0].rules[0].entries[0].path).toBe("Root");
  });

  // ── Integration with validate() ─────────────────────────────────────

  describe("integration with validate()", () => {
    it("should build a report from a broken config", () => {
      const config: FsmStateConfig = {
        key: "Broken",
        transitions: [
          ["A", "go", "NonExistent"],
          ["also wrong"] as unknown as [string, string, string],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig,
        ],
      };
      const result = validate(config);
      const report = buildReport(result);

      expect(report.valid).toBe(false);
      expect(report.summary.errors).toBeGreaterThan(0);
      expect(report.categories.length).toBeGreaterThan(0);

      const allRuleIds = report.categories.flatMap((c) =>
        c.rules.map((r) => r.rule),
      );
      expect(allRuleIds).toContain("L3");
      expect(allRuleIds).toContain("L7");
    });

    it("should build a valid report from lightBulb config", () => {
      const result = validate(lightBulb);
      const report = buildReport(result);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it("should build a report from coffeeMachine (complex nesting)", () => {
      const result = validate(coffeeMachine);
      const report = buildReport(result);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
      // coffeeMachine may have info/review issues
      expect(report.summary.total).toBe(result.issues.length);
    });

    it("should have entries with proper paths for nested configs", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          {
            key: "A",
            transitions: [["", "*", "B"]],
            states: [{ key: "bad_key", events: {} }],
          },
        ],
      };
      const result = validate(config, { rules: ["L2"] });
      const report = buildReport(result);

      if (report.categories.length > 0) {
        const entries = report.categories[0].rules[0].entries;
        const deepEntry = entries.find((e) => e.path.includes("A"));
        expect(deepEntry).toBeDefined();
        expect(deepEntry!.path).toBe("Root > A > bad_key");
      }
    });
  });
});

// ── formatReport() ───────────────────────────────────────────────────────

describe("formatReport()", () => {
  it("should format empty report as 'Validation: PASS (0 issues)'", () => {
    const report = buildReport(emptyResult);
    const text = formatReport(report);
    expect(text).toContain("Validation: PASS (0 issues)");
  });

  it("should show FAIL when errors present", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("Validation: FAIL");
  });

  it("should show PASS when only warnings present", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "warn", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("Validation: PASS");
  });

  it("should include category header", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("* Lexical Issues");
  });

  it("should include rule line with ID, severity, and description", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "bad key", path: ["Root"] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain(
      "  * L2 [warning] State keys are PascalCase",
    );
  });

  it("should include entry lines with path and message", () => {
    const result = makeResult([
      {
        rule: "L2",
        severity: "warning",
        message: 'Key "BAD" is not PascalCase',
        path: ["Root", "Child"],
      },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain(
      '    - Root > Child: Key "BAD" is not PascalCase',
    );
  });

  it("should format root path entries with (root)", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "no key", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("    - (root): no key");
  });

  it("should render all three categories in order", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "l", path: [] },
      { rule: "S1", severity: "error", message: "s", path: [] },
      { rule: "M1", severity: "warning", message: "m", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);

    const lexIdx = text.indexOf("* Lexical Issues");
    const strIdx = text.indexOf("* Structural Issues");
    const semIdx = text.indexOf("* Semantic Issues");

    expect(lexIdx).toBeGreaterThan(-1);
    expect(strIdx).toBeGreaterThan(lexIdx);
    expect(semIdx).toBeGreaterThan(strIdx);
  });

  it("should have correct summary counts in header", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
      { rule: "L2", severity: "warning", message: "w", path: [] },
      { rule: "L5", severity: "warning", message: "w", path: [] },
      { rule: "M7", severity: "info", message: "i", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("4 issues: 1 errors, 2 warnings, 1 info");
  });

  it("should omit zero-count severities from summary", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("1 issues: 1 errors");
    expect(text).not.toContain("warnings");
    expect(text).not.toContain("info");
    expect(text).not.toContain("review");
  });

  it("should end with a newline", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("should not have trailing whitespace on lines", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
      { rule: "S1", severity: "error", message: "s", path: ["Root"] },
      { rule: "M7", severity: "info", message: "i", path: ["Root", "A"] },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    const lines = text.split("\n");
    for (const line of lines) {
      expect(line).toBe(line.trimEnd());
    }
  });

  it("should handle multiple entries under a single rule", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "bad A", path: ["Root"] },
      {
        rule: "L2",
        severity: "warning",
        message: "bad B",
        path: ["Root", "Parent"],
      },
    ]);
    const report = buildReport(result);
    const text = formatReport(report);
    expect(text).toContain("    - Root: bad A");
    expect(text).toContain("    - Root > Parent: bad B");
  });

  // ── Round-trip integration ──────────────────────────────────────────

  describe("round-trip integration", () => {
    it("should produce meaningful output for a broken config", () => {
      const config: FsmStateConfig = {
        key: "Broken",
        transitions: [
          ["", "*", "A"],
          ["also wrong"] as unknown as [string, string, string],
        ],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig,
        ],
      };
      const result = validate(config);
      const report = buildReport(result);
      const text = formatReport(report);

      expect(text).toContain("Validation: FAIL");
      expect(text).toContain("* Lexical Issues");
      expect(text).toContain("L3");
      expect(text).toContain("L7");
      expect(text).toContain("[error]");
    });

    it("should produce clean output for valid lightBulb config", () => {
      const result = validate(lightBulb);
      const report = buildReport(result);
      const text = formatReport(report);

      expect(text).toContain("Validation: PASS");
    });
  });
});
