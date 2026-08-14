import { parse } from "yaml";
import { ruleDefinitions } from "../src/agent-rules.ts";
import { buildReport, formatReport } from "../src/report.ts";
import type {
  FsmStateConfig,
  ValidationIssue,
  ValidationResult,
} from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import { coffeeMachine, documentReview, lightBulb } from "./fixtures.ts";

const ticketFlowYaml = `
key: TicketFlow
name: Support Ticket Lifecycle
description: Support ticket lifecycle
outcome: Ticket is resolved and closed
roles: [Customer, L1 Agent, L2 Agent]
object: support ticket
transitions:
  - ["", "*", Handle]
  - [Handle, resolved, Closed]
  - [Closed, done, ""]
states:
  - key: Handle
    description: Handle the support ticket
    outcome: Issue is diagnosed and resolved
    events:
      resolved: When the issue has been fully resolved
    transitions:
      - ["", "*", Diagnose]
      - [Diagnose, notResolved, Escalate]
      - [Diagnose, resolved, ""]
      - [Escalate, resolved, ""]
    states:
      - key: Diagnose
        description: Identify the issue
        outcome: Root cause is identified
        events:
          resolved: When the issue is identified and fixed
          notResolved: When the issue cannot be resolved at current level
      - key: Escalate
        description: Escalate to L2
        outcome: Issue is resolved by L2 team
        events:
          resolved: When L2 team resolves the issue
  - key: Closed
    description: Ticket is closed
    events:
      done: When closing procedures are complete
`;

const ticketFlow: FsmStateConfig = parse(ticketFlowYaml);

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
    const report = buildReport(emptyResult, ruleDefinitions);
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

  it("should expose the raw ValidationResult", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    expect(report.result).toBe(result);
    expect(report.result.issues).toHaveLength(1);
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
    const report = buildReport(result, ruleDefinitions);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Lexical Issues");
    expect(report.categories[0].rules).toHaveLength(1);
    expect(report.categories[0].rules[0].rule).toBe("L1");
    expect(report.categories[0].rules[0].severity).toBe("error");
    expect(report.categories[0].rules[0].entries).toHaveLength(1);
  });

  it("should include name and constraint from rule definitions", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const rg = report.categories[0].rules[0];
    expect(rg.name).toBe("key is mandatory");
    expect(rg.constraint).toBe(
      "Every state object MUST have a non-empty `key` field",
    );
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
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Lexical Issues");
    expect(report.categories[0].rules).toHaveLength(2);
    expect(report.categories[0].rules[0].rule).toBe("L2");
    expect(report.categories[0].rules[1].rule).toBe("L3");
  });

  it("should produce all three categories when issues span L, S, M", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "lex issue", path: [] },
      { rule: "S1", severity: "error", message: "struct issue", path: [] },
      { rule: "M1", severity: "warning", message: "sem issue", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
    expect(report.categories[0].rules[0].entries[0].path).toBe(
      "Root > Handle > Diagnose",
    );
  });

  it("should format empty path as '(root)'", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "no key", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    expect(report.categories[0].rules[0].entries[0].path).toBe("(root)");
  });

  it("should compute summary counts correctly", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e1", path: [] },
      { rule: "L3", severity: "error", message: "e2", path: [] },
      { rule: "L2", severity: "warning", message: "w1", path: [] },
      { rule: "M7", severity: "info", message: "i1", path: [] },
      { rule: "M8", severity: "review", message: "r1", path: [] },
      { rule: "M9", severity: "review", message: "r2", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    expect(buildReport(validResult, ruleDefinitions).valid).toBe(true);

    const invalidResult = makeResult(
      [{ rule: "L1", severity: "error", message: "err", path: [] }],
      false,
    );
    expect(buildReport(invalidResult, ruleDefinitions).valid).toBe(false);
  });

  it("should order categories as Lexical, Structural, Semantic", () => {
    const result = makeResult([
      { rule: "M1", severity: "warning", message: "m", path: [] },
      { rule: "L1", severity: "error", message: "l", path: [] },
      { rule: "S1", severity: "error", message: "s", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
    const ruleIds = report.categories[0].rules.map((r) => r.rule);
    expect(ruleIds).toEqual(["L2", "L3", "L7"]);
  });

  it("should handle single-element path", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "bad", path: ["Root"] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    expect(report.categories[0].rules[0].entries[0].path).toBe("Root");
  });

  it("should use only provided rules for grouping", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
      { rule: "S1", severity: "error", message: "err", path: [] },
    ]);
    // Pass only lexical rules
    const lexicalOnly = ruleDefinitions.filter((r) => r.category === "lexical");
    const report = buildReport(result, lexicalOnly);
    // S1 issue exists but no structural rules → only Lexical category
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].category).toBe("Lexical Issues");
    // Summary still counts ALL issues regardless of rules provided
    expect(report.summary.total).toBe(2);
  });

  it("should populate constraint for each rule group", () => {
    const result = makeResult([
      { rule: "S1", severity: "error", message: "no init", path: [] },
      { rule: "L3", severity: "error", message: "bad tuple", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const s1 = report.categories
      .flatMap((c) => c.rules)
      .find((r) => r.rule === "S1");
    const l3 = report.categories
      .flatMap((c) => c.rules)
      .find((r) => r.rule === "L3");
    expect(s1?.constraint).toContain('["", "*", X]');
    expect(l3?.constraint).toContain("[sourceRef, eventRef, targetRef]");
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
      const report = buildReport(result, ruleDefinitions);

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
      const report = buildReport(result, ruleDefinitions);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it("should build a report from coffeeMachine (complex nesting)", () => {
      const result = validate(coffeeMachine);
      const report = buildReport(result, ruleDefinitions);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
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
      const report = buildReport(result, ruleDefinitions);

      if (report.categories.length > 0) {
        const entries = report.categories[0].rules[0].entries;
        const deepEntry = entries.find((e) => e.path.includes("A"));
        expect(deepEntry).toBeDefined();
        expect(deepEntry?.path).toBe("Root > A > bad_key");
      }
    });
  });
});

// ── formatReport() ───────────────────────────────────────────────────────

describe("formatReport()", () => {
  it("should format empty report as 'Validation: PASS (0 issues)'", () => {
    const report = buildReport(emptyResult, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("Validation: PASS (0 issues)");
  });

  it("should show FAIL when errors present", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("Validation: FAIL");
  });

  it("should show PASS when only warnings present", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "warn", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("Validation: PASS");
  });

  it("should include category header", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("* Lexical Issues");
  });

  it("should include rule line with ID, severity, and name", () => {
    const result = makeResult([
      { rule: "L2", severity: "warning", message: "bad key", path: ["Root"] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("  * L2 [warning] State keys are PascalCase");
  });

  it("should include constraint line after rule header", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain(
      "    Rule: Every state object MUST have a non-empty `key` field",
    );
  });

  it("should include Issues: label before entries", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "err", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("    Issues:");
  });

  it("should render rule header, constraint, and entries in order", () => {
    const result = makeResult([
      { rule: "L3", severity: "error", message: "bad tuple", path: ["Root"] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);

    const ruleIdx = text.indexOf("  * L3 [error] Transition is a 3-tuple");
    const constraintIdx = text.indexOf("    Rule:");
    const issuesIdx = text.indexOf("    Issues:");
    const entryIdx = text.indexOf("    - Root: bad tuple");

    expect(ruleIdx).toBeGreaterThan(-1);
    expect(constraintIdx).toBeGreaterThan(ruleIdx);
    expect(issuesIdx).toBeGreaterThan(constraintIdx);
    expect(entryIdx).toBeGreaterThan(issuesIdx);
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
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain('    - Root > Child: Key "BAD" is not PascalCase');
  });

  it("should format root path entries with (root)", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "no key", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("    - (root): no key");
  });

  it("should render all three categories in order", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "l", path: [] },
      { rule: "S1", severity: "error", message: "s", path: [] },
      { rule: "M1", severity: "warning", message: "m", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text).toContain("4 issues: 1 errors, 2 warnings, 1 info");
  });

  it("should omit zero-count severities from summary", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
    const text = formatReport(report);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("should not have trailing whitespace on lines", () => {
    const result = makeResult([
      { rule: "L1", severity: "error", message: "e", path: [] },
      { rule: "S1", severity: "error", message: "s", path: ["Root"] },
      { rule: "M7", severity: "info", message: "i", path: ["Root", "A"] },
    ]);
    const report = buildReport(result, ruleDefinitions);
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
    const report = buildReport(result, ruleDefinitions);
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
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(text).toContain("Validation: FAIL");
      expect(text).toContain("* Lexical Issues");
      expect(text).toContain("L3");
      expect(text).toContain("L7");
      expect(text).toContain("[error]");
      expect(text).toContain("Rule:");
      expect(text).toContain("Issues:");
    });

    it("should produce clean output for valid lightBulb config", () => {
      const result = validate(lightBulb);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(text).toContain("Validation: PASS");
    });

    it("should include constraint text in formatted output", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          { key: "A" } as FsmStateConfig,
          { key: "A" } as FsmStateConfig,
        ],
      };
      const result = validate(config, { rules: ["L7"] });
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(text).toContain("No duplicate keys among siblings");
      expect(text).toContain(
        "Rule: Within a single `states[]` array, all `key` values are unique",
      );
    });
  });
});

// ── End-to-end: real HFSM configs ────────────────────────────────────────

describe("end-to-end: validate → buildReport → formatReport", () => {
  // ── Valid configs ───────────────────────────────────────────────────

  describe("valid fixtures", () => {
    it("lightBulb: no errors, valid report", () => {
      const result = validate(lightBulb);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
      expect(text).toContain("Validation: PASS");
      // review issues may appear (M8/M9)
      for (const cat of report.categories) {
        for (const rg of cat.rules) {
          expect(rg.name.length).toBeGreaterThan(0);
          expect(rg.constraint.length).toBeGreaterThan(0);
          for (const e of rg.entries) {
            expect(e.message.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("ticketFlow: no errors, nested paths present", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
      // ticketFlow has nested states — check paths contain hierarchy
      const allPaths = report.categories.flatMap((c) =>
        c.rules.flatMap((r) => r.entries.map((e) => e.path)),
      );
      if (allPaths.length > 0) {
        const hasNested = allPaths.some((p) => p.includes(" > "));
        expect(hasNested).toBe(true);
      }
      expect(text).toContain("Validation: PASS");
    });

    it("coffeeMachine: no errors, review issues include state names", () => {
      const result = validate(coffeeMachine);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
      // coffeeMachine has descriptions → M8/M9 should fire with state names
      if (report.summary.review > 0) {
        const reviewRules = report.categories.flatMap((c) =>
          c.rules.filter((r) => r.severity === "review"),
        );
        expect(reviewRules.length).toBeGreaterThan(0);
        // messages should reference actual state names
        const allMessages = reviewRules.flatMap((r) =>
          r.entries.map((e) => e.message),
        );
        const mentionsState = allMessages.some(
          (m) =>
            m.includes("Idle") ||
            m.includes("WelcomeScreen") ||
            m.includes("PreparingDrink"),
        );
        expect(mentionsState).toBe(true);
        expect(text).toContain("* Semantic Issues");
      }
    });

    it("documentReview: no errors, formatted output has no error section", () => {
      const result = validate(documentReview);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
      expect(text).not.toContain("[error]");
    });
  });

  // ── Invalid configs: lexical issues ────────────────────────────────

  describe("lexical diagnostics", () => {
    it("should detect empty key (L1) and include state path", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", ""]],
        states: [{ key: "" } as FsmStateConfig],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(false);
      const l1 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "L1");
      expect(l1).toBeDefined();
      expect(l1?.severity).toBe("error");
      expect(l1?.entries.length).toBeGreaterThan(0);
      expect(text).toContain("[error] key is mandatory");
    });

    it("should detect non-PascalCase keys (L2) with key names in messages", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "UPPER_CASE"]],
        states: [{ key: "UPPER_CASE", events: {} }],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const l2 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "L2");
      expect(l2).toBeDefined();
      expect(l2?.entries.some((e) => e.message.includes("UPPER_CASE"))).toBe(
        true,
      );
      expect(text).toContain("UPPER_CASE");
      expect(text).toContain("[warning]");
    });

    it("should detect malformed transitions (L3) with index info", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["bad"] as unknown as [string, string, string],
          ["A", "go", "B"],
          [1, 2] as unknown as [string, string, string],
        ],
        states: [
          { key: "A", events: {} },
          { key: "B", events: {} },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const l3 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "L3");
      expect(l3).toBeDefined();
      expect(l3?.entries.length).toBe(2);
      // messages include transition index
      expect(l3?.entries.some((e) => e.message.includes("index 1"))).toBe(true);
      expect(l3?.entries.some((e) => e.message.includes("index 3"))).toBe(true);
      expect(text).toContain("Transition is a 3-tuple");
      expect(text).toContain("[sourceRef, eventRef, targetRef]");
    });

    it("should detect duplicate sibling keys (L7) with key names", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          { key: "A", events: {} },
          { key: "A", events: {} },
          { key: "B", events: {} },
          { key: "B", events: {} },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const l7 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "L7");
      expect(l7).toBeDefined();
      expect(l7?.entries.length).toBe(2);
      expect(l7?.entries.some((e) => e.message.includes('"A"'))).toBe(true);
      expect(l7?.entries.some((e) => e.message.includes('"B"'))).toBe(true);
      expect(text).toContain("No duplicate keys among siblings");
    });
  });

  // ── Invalid configs: structural issues ─────────────────────────────

  describe("structural diagnostics", () => {
    it("should detect missing initial transition (S1)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["A", "go", "B"]],
        states: [
          { key: "A", events: {} },
          { key: "B", events: {} },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const s1 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S1");
      expect(s1).toBeDefined();
      expect(s1?.severity).toBe("error");
      expect(s1?.entries.some((e) => e.message.includes("Root"))).toBe(true);
      expect(text).toContain("* Structural Issues");
      expect(text).toContain("Initial transition required");
    });

    it("should detect dangling references (S2) with state names", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "NonExistent"],
        ],
        states: [{ key: "A", events: { go: "When going" } }],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const s2 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S2");
      expect(s2).toBeDefined();
      expect(s2?.entries.some((e) => e.message.includes("NonExistent"))).toBe(
        true,
      );
      expect(text).toContain("NonExistent");
    });

    it("should detect unreachable states (S4)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          { key: "A", events: {} },
          { key: "Orphan", events: {} },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);

      const s4 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S4");
      expect(s4).toBeDefined();
      expect(s4?.entries.some((e) => e.message.includes("Orphan"))).toBe(true);
    });

    it("should detect missing events on leaf states (S8)", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          { key: "A" } as FsmStateConfig, // no events
          { key: "B" } as FsmStateConfig, // no events
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const s8 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S8");
      expect(s8).toBeDefined();
      // both A and B should be flagged
      expect(s8?.entries.length).toBe(2);
      expect(text).toContain("Events mandatory for leaf states");
    });
  });

  // ── Invalid configs: semantic issues ───────────────────────────────

  describe("semantic diagnostics", () => {
    it("should detect uncovered events (M1) with event names", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
        ],
        states: [
          {
            key: "A",
            events: {
              go: "handled",
              orphanEvent: "not handled by any transition",
            },
          },
          { key: "B", events: {} },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const m1 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M1");
      expect(m1).toBeDefined();
      expect(m1?.entries.some((e) => e.message.includes("orphanEvent"))).toBe(
        true,
      );
      expect(text).toContain("orphanEvent");
      expect(text).toContain("Forward event coverage");
    });

    it("should detect review items (M9) with parent-child descriptions", () => {
      const config: FsmStateConfig = {
        key: "Root",
        description: "Main process",
        outcome: "Process completed",
        transitions: [["", "*", "Step"]],
        states: [
          {
            key: "Step",
            description: "A processing step",
            outcome: "Step done",
            events: { done: "When step completes" },
          },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      console.log(JSON.stringify(report, null, 2));
      const text = formatReport(report);

      const m9 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M9");
      expect(m9).toBeDefined();
      expect(m9?.severity).toBe("review");
      // M9 messages should contain both parent and child descriptions
      expect(
        m9?.entries.some(
          (e) => e.message.includes("Step") && e.message.includes("Root"),
        ),
      ).toBe(true);
      expect(text).toContain("[review]");
      expect(text).toContain("Parent-child goal alignment");
    });

    it("should detect event-state semantic consistency (M8) with event details", () => {
      const config: FsmStateConfig = {
        key: "Root",
        description: "Main workflow",
        transitions: [["", "*", "Working"]],
        states: [
          {
            key: "Working",
            description: "Actively processing",
            events: {
              complete: "When processing finishes",
              fail: "When an error occurs",
            },
          },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      const m8 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M8");
      expect(m8).toBeDefined();
      // Should mention event names and descriptions
      expect(m8?.entries.some((e) => e.message.includes("complete"))).toBe(
        true,
      );
      expect(m8?.entries.some((e) => e.message.includes("fail"))).toBe(true);
      expect(text).toContain("Event-state semantic consistency");
    });
  });

  // ── Complex multi-issue config ─────────────────────────────────────

  describe("complex multi-issue config", () => {
    it("should report issues across all categories with proper formatting", () => {
      const config: FsmStateConfig = {
        key: "BadMachine",
        description: "A machine with many issues",
        transitions: [
          ["", "*", "STEP_ONE"],
          ["STEP_ONE", "Go", "step_two"],
          ["bad tuple"] as unknown as [string, string, string],
        ],
        states: [
          {
            key: "STEP_ONE",
            description: "First step",
            events: { Go: "Start", unused: "Never triggered" },
          },
          { key: "step_two" } as FsmStateConfig,
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      // Should be invalid
      expect(report.valid).toBe(false);
      expect(text).toContain("Validation: FAIL");

      // Should have issues in multiple categories
      expect(report.categories.length).toBeGreaterThanOrEqual(2);

      // Formatted text has proper structure
      expect(text).toContain("Rule:");
      expect(text).toContain("Issues:");

      // All rule groups have non-empty name and constraint
      for (const cat of report.categories) {
        for (const rg of cat.rules) {
          expect(rg.name.length).toBeGreaterThan(0);
          expect(rg.constraint.length).toBeGreaterThan(0);
          expect(rg.entries.length).toBeGreaterThan(0);
        }
      }

      // Summary counts should match
      const totalFromCategories = report.categories.reduce(
        (sum, c) => sum + c.rules.reduce((s, r) => s + r.entries.length, 0),
        0,
      );
      // Note: totalFromCategories may be <= summary.total because some issues
      // might not match any provided rule definition
      expect(totalFromCategories).toBeGreaterThan(0);
      expect(totalFromCategories).toBeLessThanOrEqual(report.summary.total);

      // No trailing whitespace in output
      for (const line of text.split("\n")) {
        expect(line).toBe(line.trimEnd());
      }
    });
  });

  // ── Deeply nested config ───────────────────────────────────────────

  describe("deeply nested config", () => {
    it("should produce paths reflecting full hierarchy", () => {
      const config: FsmStateConfig = {
        key: "Root",
        description: "Top level",
        transitions: [["", "*", "Level1"]],
        states: [
          {
            key: "Level1",
            description: "First level",
            transitions: [["", "*", "Level2"]],
            states: [
              {
                key: "Level2",
                description: "Second level",
                transitions: [["", "*", "Leaf"]],
                states: [
                  {
                    key: "Leaf",
                    description: "Bottom state",
                    events: { done: "When complete" },
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = validate(config);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      // Review issues (M9, M8) should have deep paths
      const allPaths = report.categories.flatMap((c) =>
        c.rules.flatMap((r) => r.entries.map((e) => e.path)),
      );
      if (allPaths.length > 0) {
        const deepPath = allPaths.find(
          (p) => p.includes("Level1") && p.includes("Level2"),
        );
        expect(deepPath).toBeDefined();
        // formatted output should contain the nested path
        expect(text).toContain("Level1");
        expect(text).toContain("Level2");
      }
    });
  });

  // ── TicketFlow ─────────────────────────────────────────────────────

  describe("TicketFlow", () => {
    it("should validate without errors", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it("should have review issues for parent-child goal alignment (M9)", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      const m9 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M9");
      expect(m9).toBeDefined();
      expect(m9?.severity).toBe("review");
      // Should mention the nested states by name
      const messages = m9?.entries.map((e) => e.message);
      expect(messages.some((m) => m.includes("Handle"))).toBe(true);
      expect(messages.some((m) => m.includes("Diagnose"))).toBe(true);
      expect(messages.some((m) => m.includes("Escalate"))).toBe(true);
      expect(messages.some((m) => m.includes("Closed"))).toBe(true);
    });

    it("should have review issues for event-state consistency (M8)", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      const m8 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M8");
      expect(m8).toBeDefined();
      // M8 reports each event alongside state descriptions
      const messages = m8?.entries.map((e) => e.message);
      // Events from Handle, Diagnose, Escalate, Closed
      expect(messages.some((m) => m.includes("resolved"))).toBe(true);
      expect(messages.some((m) => m.includes("done"))).toBe(true);
      expect(messages.some((m) => m.includes("notResolved"))).toBe(true);
    });

    it("should have nested paths for Handle sub-states", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      const allPaths = report.categories.flatMap((c) =>
        c.rules.flatMap((r) => r.entries.map((e) => e.path)),
      );
      // Diagnose is at TicketFlow > Handle > Diagnose
      expect(
        allPaths.some((p) => p.includes("Handle") && p.includes("Diagnose")),
      ).toBe(true);
      // Escalate is at TicketFlow > Handle > Escalate
      expect(
        allPaths.some((p) => p.includes("Handle") && p.includes("Escalate")),
      ).toBe(true);
    });

    it("should produce well-structured formatted output", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      // Valid config
      expect(text).toContain("Validation: PASS");
      // Should have Semantic Issues category (M8/M9 review items)
      expect(text).toContain("* Semantic Issues");
      // Should have Rule: and Issues: labels
      expect(text).toContain("Rule:");
      expect(text).toContain("Issues:");
      // Should mention state names in entries
      expect(text).toContain("Handle");
      expect(text).toContain("Diagnose");
      expect(text).toContain("Escalate");
      expect(text).toContain("Closed");
      // No trailing whitespace
      for (const line of text.split("\n")) {
        expect(line).toBe(line.trimEnd());
      }
    });

    it("should include event descriptions in M8 review messages", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);
      const _text = formatReport(report);

      // M8 entries should include the event description text
      const m8 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M8");
      expect(m8).toBeDefined();
      const messages = m8?.entries.map((e) => e.message);
      // Event descriptions from the config
      expect(
        messages.some((m) =>
          m.includes("When the issue has been fully resolved"),
        ),
      ).toBe(true);
      expect(
        messages.some((m) =>
          m.includes("When closing procedures are complete"),
        ),
      ).toBe(true);
    });

    it("should include parent descriptions in M9 review messages", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      const m9 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M9");
      expect(m9).toBeDefined();
      const messages = m9?.entries.map((e) => e.message);
      // M9 should reference parent descriptions/outcomes
      expect(messages.some((m) => m.includes("Support ticket lifecycle"))).toBe(
        true,
      );
      // Handle state description
      expect(
        messages.some((m) => m.includes("Handle the support ticket")),
      ).toBe(true);
    });

    it("should correctly count review issues in summary", () => {
      const result = validate(ticketFlow);
      const report = buildReport(result, ruleDefinitions);

      expect(report.summary.review).toBeGreaterThan(0);
      expect(report.summary.errors).toBe(0);
      expect(report.summary.warnings).toBe(0);
    });

    it("should detect issues when ticketFlow is broken", () => {
      // Take the ticketFlow config and break it
      const broken: FsmStateConfig = {
        ...ticketFlow,
        transitions: [
          ["", "*", "Handle"],
          ["Handle", "resolved", "NonExistent"], // dangling ref
          ["Closed", "done", ""],
        ],
      };
      const result = validate(broken);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);

      expect(report.valid).toBe(false);
      expect(text).toContain("Validation: FAIL");
      // S2: dangling reference
      const s2 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S2");
      expect(s2).toBeDefined();
      expect(s2?.entries.some((e) => e.message.includes("NonExistent"))).toBe(
        true,
      );
      expect(text).toContain("NonExistent");
    });

    it("should detect issues when Handle sub-machine is broken", () => {
      // Break the nested Handle sub-machine
      const brokenNested: FsmStateConfig = {
        key: "TicketFlow",
        description: "Support ticket lifecycle",
        outcome: "Ticket is resolved and closed",
        transitions: [
          ["", "*", "Handle"],
          ["Handle", "resolved", "Closed"],
          ["Closed", "done", ""],
        ],
        states: [
          {
            key: "Handle",
            description: "Handle the support ticket",
            outcome: "Issue is diagnosed and resolved",
            events: { resolved: "When the issue has been fully resolved" },
            transitions: [
              ["", "*", "Diagnose"],
              // Missing: Diagnose → Escalate transition
              ["Diagnose", "resolved", ""],
              ["Escalate", "resolved", ""],
            ],
            states: [
              {
                key: "Diagnose",
                description: "Identify the issue",
                outcome: "Root cause is identified",
                events: {
                  resolved: "When the issue is identified and fixed",
                  notResolved: "not handled", // no transition for this event
                },
              },
              {
                key: "Escalate",
                description: "Escalate to L2",
                outcome: "Issue is resolved by L2 team",
                events: { resolved: "When L2 team resolves the issue" },
              },
            ],
          },
          {
            key: "Closed",
            description: "Ticket is closed",
            events: { done: "When closing procedures are complete" },
          },
        ],
      };
      const result = validate(brokenNested);
      const report = buildReport(result, ruleDefinitions);
      const text = formatReport(report);
      console.log(text);

      // S4: Escalate unreachable (no transition leads to it)
      const s4 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "S4");
      expect(s4).toBeDefined();
      expect(s4?.entries.some((e) => e.message.includes("Escalate"))).toBe(
        true,
      );

      // Path should include Handle
      expect(s4?.entries.some((e) => e.path.includes("Handle"))).toBe(true);

      // M1: notResolved event declared but no transition handles it
      const m1 = report.categories
        .flatMap((c) => c.rules)
        .find((r) => r.rule === "M1");
      expect(m1).toBeDefined();
      expect(m1?.entries.some((e) => e.message.includes("notResolved"))).toBe(
        true,
      );

      // Formatted output should contain all this
      expect(text).toContain("Escalate");
      expect(text).toContain("notResolved");
    });
  });
});
