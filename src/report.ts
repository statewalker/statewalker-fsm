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

/**
 * Format a compact report: only errors and warnings inline,
 * review items as a short table (path + event/child only, no descriptions).
 */
export function formatReportCompact(report: ValidationReport): string {
  const { summary } = report;
  const status = report.valid ? "PASS" : "FAIL";

  const parts: string[] = [];
  if (summary.errors > 0) parts.push(`${summary.errors}E`);
  if (summary.warnings > 0) parts.push(`${summary.warnings}W`);
  if (summary.review > 0) parts.push(`${summary.review}R`);
  if (summary.info > 0) parts.push(`${summary.info}I`);

  const lines: string[] = [
    `**${status}** ${parts.length > 0 ? parts.join("/") : "clean"}`,
    "",
  ];

  // Errors and warnings: show full messages (they're actionable)
  const actionable = report.categories.flatMap((cat) =>
    cat.rules.filter(
      (rg) => rg.severity === "error" || rg.severity === "warning",
    ),
  );
  if (actionable.length > 0) {
    lines.push("| Rule | Path | Issue |");
    lines.push("|------|------|-------|");
    for (const rg of actionable) {
      for (const entry of rg.entries) {
        lines.push(`| ${rg.rule} (${rg.severity}) | ${entry.path} | ${entry.message} |`);
      }
    }
    lines.push("");
  }

  // Review items: compact table — just path + what's being reviewed
  if (summary.review > 0) {
    lines.push(`<details><summary>${summary.review} review items (M8/M9)</summary>`);
    lines.push("");
    lines.push("| Rule | Path | Subject |");
    lines.push("|------|------|---------|");
    for (const cat of report.categories) {
      for (const rg of cat.rules) {
        if (rg.severity !== "review") continue;
        for (const entry of rg.entries) {
          const short = compactReviewMessage(rg.rule, entry.message);
          lines.push(`| ${rg.rule} | ${entry.path} | ${short} |`);
        }
      }
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n");
}

function compactReviewMessage(rule: RuleId, message: string): string {
  if (rule === "M8") {
    // Extract: event "X" from state "Y"
    const eventMatch = message.match(/event "([^"]+)"/);
    return eventMatch ? `event: ${eventMatch[1]}` : message.slice(0, 60);
  }
  if (rule === "M9") {
    // Extract: child "X" in parent "Y"
    const childMatch = message.match(/Child state "([^"]+)"/);
    const parentMatch = message.match(/nested in "([^"]+)"/);
    if (childMatch && parentMatch) {
      return `${childMatch[1]} in ${parentMatch[1]}`;
    }
    return message.slice(0, 60);
  }
  if (rule === "M4") {
    return message.slice(0, 80);
  }
  return message.slice(0, 60);
}
