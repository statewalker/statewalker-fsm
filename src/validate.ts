import { allRules } from "./rules/index.ts";
import type {
  FsmStateConfig,
  RuleContext,
  RuleFunction,
  RuleId,
  ValidationIssue,
  ValidationOptions,
  ValidationResult,
} from "./types.ts";

export function validate(
  config: FsmStateConfig,
  options?: ValidationOptions,
): ValidationResult {
  const activeRules = resolveActiveRules(options);
  const issues: ValidationIssue[] = [];

  walkConfig(config, [], config, undefined, activeRules, issues);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

function resolveActiveRules(
  options?: ValidationOptions,
): Map<RuleId, RuleFunction> {
  if (!options?.rules && !options?.exclude) return allRules;
  let entries = [...allRules.entries()];
  if (options.rules) {
    const allowed = new Set(options.rules);
    entries = entries.filter(([id]) => allowed.has(id));
  }
  if (options.exclude) {
    const excluded = new Set(options.exclude);
    entries = entries.filter(([id]) => !excluded.has(id));
  }
  return new Map(entries);
}

function walkConfig(
  config: FsmStateConfig,
  path: string[],
  root: FsmStateConfig,
  parent: FsmStateConfig | undefined,
  rules: Map<RuleId, RuleFunction>,
  issues: ValidationIssue[],
): void {
  const ctx: RuleContext = { config, path, root, parent };
  for (const rule of rules.values()) {
    issues.push(...rule(ctx));
  }
  if (config.states) {
    for (const child of config.states) {
      walkConfig(child, [...path, config.key], root, config, rules, issues);
    }
  }
}
