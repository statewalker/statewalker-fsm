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

export function validate(config: FsmStateConfig, options?: ValidationOptions): ValidationResult {
  const activeRules = resolveActiveRules(options);
  const issues: ValidationIssue[] = [];

  const normalized = normalizeConfig(config);
  walkConfig(normalized, [], normalized, [], activeRules, issues);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const review = issues.filter((i) => i.severity === "review");
  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    review,
  };
}

function resolveActiveRules(options?: ValidationOptions): Map<RuleId, RuleFunction> {
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
  ancestors: FsmStateConfig[],
  rules: Map<RuleId, RuleFunction>,
  issues: ValidationIssue[],
): void {
  const raw = rawConfigs.get(config) ?? config;
  const ctx: RuleContext = {
    config,
    path,
    root,
    parent: ancestors[0],
    ancestors,
  };
  // Lexical rules see the transitions as written, so L3 can report the
  // malformed ones; every other rule sees only well-formed tuples.
  const lexicalCtx: RuleContext = { ...ctx, config: { ...config, transitions: raw.transitions } };
  for (const [id, rule] of rules) {
    issues.push(...rule(id.startsWith("L") ? lexicalCtx : ctx));
  }
  if (rules.has("L1")) {
    if (raw.states !== undefined && !Array.isArray(raw.states)) {
      issues.push({
        rule: "L1",
        severity: "error",
        message: "'states' must be an array of state objects",
        path: [...path, config.key],
      });
    } else if (Array.isArray(raw.states)) {
      raw.states.forEach((child: unknown, i: number) => {
        if (isObject(child)) return;
        issues.push({
          rule: "L1",
          severity: "error",
          message: `State at index ${i} must be an object with a non-empty 'key' property, got ${child === null ? "null" : typeof child}`,
          path: [...path, config.key],
        });
      });
    }
  }
  if (config.states) {
    for (const child of config.states) {
      walkConfig(child, [...path, config.key], root, [config, ...ancestors], rules, issues);
    }
  }
}

/** Normalized config → the config as the caller wrote it. */
const rawConfigs = new WeakMap<FsmStateConfig, FsmStateConfig>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A copy of the tree the structural and semantic rules can trust: transitions
 * hold only 3-element arrays and `states` only objects. Configs written by AI
 * agents are the main input, so malformed parts must be reported (L1, L3),
 * never crash the rules that assume a well-formed shape.
 */
function normalizeConfig(config: FsmStateConfig): FsmStateConfig {
  const normalized: FsmStateConfig = { ...config };
  if (config.transitions !== undefined) {
    normalized.transitions = Array.isArray(config.transitions)
      ? config.transitions.filter((t) => Array.isArray(t) && t.length === 3)
      : [];
  }
  if (config.states !== undefined) {
    normalized.states = Array.isArray(config.states)
      ? (config.states as unknown[])
          .filter(isObject)
          .map((c) => normalizeConfig(c as FsmStateConfig))
      : [];
  }
  rawConfigs.set(normalized, config);
  return normalized;
}
