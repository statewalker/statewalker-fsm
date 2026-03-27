import type { RuleDefinition } from "./agent-rules.ts";
import type { RuleId, Severity, ValidationResult } from "./types.ts";

export type ReportIssueEntry = {
  path: string;
  message: string;
};

export type ReportRuleGroup = {
  rule: RuleId;
  severity: Severity;
  name: string;
  constraint: string;
  entries: ReportIssueEntry[];
};

export type ReportCategory = {
  category: "Lexical Issues" | "Structural Issues" | "Semantic Issues";
  rules: ReportRuleGroup[];
};

export type ValidationReport = {
  valid: boolean;
  result: ValidationResult;
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    review: number;
  };
  categories: ReportCategory[];
};

const categoryDisplayNames: Record<string, ReportCategory["category"]> = {
  lexical: "Lexical Issues",
  structural: "Structural Issues",
  semantic: "Semantic Issues",
};

const categoryOrder = ["lexical", "structural", "semantic"] as const;

export function buildReport(
  result: ValidationResult,
  rules: RuleDefinition[],
): ValidationReport {
  const grouped = new Map<
    RuleId,
    { severity: Severity; entries: ReportIssueEntry[] }
  >();

  for (const issue of result.issues) {
    let group = grouped.get(issue.rule);
    if (!group) {
      group = { severity: issue.severity, entries: [] };
      grouped.set(issue.rule, group);
    }
    group.entries.push({
      path: issue.path.length > 0 ? issue.path.join(" > ") : "(root)",
      message: issue.message,
    });
  }

  const categories: ReportCategory[] = [];

  for (const cat of categoryOrder) {
    const catRules = rules.filter((rd) => rd.category === cat);
    const ruleGroups: ReportRuleGroup[] = [];

    for (const rd of catRules) {
      const group = grouped.get(rd.ruleId);
      if (!group) continue;
      ruleGroups.push({
        rule: rd.ruleId,
        severity: group.severity,
        name: rd.rule,
        constraint: rd.constraint,
        entries: group.entries,
      });
    }

    if (ruleGroups.length > 0) {
      categories.push({
        category: categoryDisplayNames[cat],
        rules: ruleGroups,
      });
    }
  }

  const issues = result.issues;
  return {
    valid: result.valid,
    result,
    summary: {
      total: issues.length,
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      review: issues.filter((i) => i.severity === "review").length,
    },
    categories,
  };
}

export function formatReport(report: ValidationReport): string {
  const { summary } = report;
  const status = report.valid ? "PASS" : "FAIL";

  const parts: string[] = [];
  if (summary.errors > 0) parts.push(`${summary.errors} errors`);
  if (summary.warnings > 0) parts.push(`${summary.warnings} warnings`);
  if (summary.info > 0) parts.push(`${summary.info} info`);
  if (summary.review > 0) parts.push(`${summary.review} review`);

  let header: string;
  if (summary.total === 0) {
    header = `Validation: ${status} (0 issues)`;
  } else {
    header = `Validation: ${status} (${summary.total} issues: ${parts.join(", ")})`;
  }

  const lines: string[] = [header];

  for (const cat of report.categories) {
    lines.push("");
    lines.push(`* ${cat.category}`);
    for (const rg of cat.rules) {
      lines.push(`  * ${rg.rule} [${rg.severity}] ${rg.name}`);
      lines.push(`    Rule: ${rg.constraint}`);
      lines.push("    Issues:");
      for (const entry of rg.entries) {
        lines.push(`    - ${entry.path}: ${entry.message}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
