import type {
  RuleContext,
  RuleFunction,
  RuleId,
  ValidationIssue,
} from "../types.ts";

export const STATE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
export const EVENT_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export function keyRequired(ctx: RuleContext): ValidationIssue[] {
  if (typeof ctx.config.key !== "string" || ctx.config.key === "") {
    return [
      {
        rule: "L1",
        severity: "error",
        message: "State must have a non-empty 'key' property",
        path: ctx.path,
      },
    ];
  }
  return [];
}

export function stateKeyFormat(ctx: RuleContext): ValidationIssue[] {
  if (!ctx.config.key || !STATE_KEY_PATTERN.test(ctx.config.key)) return [];
  // Only warn if the key exists but doesn't match the recommended PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(ctx.config.key)) {
    return [
      {
        rule: "L2",
        severity: "warning",
        message: `State key "${ctx.config.key}" does not follow PascalCase convention`,
        path: [...ctx.path, ctx.config.key],
      },
    ];
  }
  return [];
}

export function transitionTupleLength(ctx: RuleContext): ValidationIssue[] {
  const transitions = ctx.config.transitions;
  if (!transitions) return [];
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (!Array.isArray(t) || t.length !== 3) {
      issues.push({
        rule: "L3",
        severity: "error",
        message: `Transition at index ${i} must be a 3-element array [from, event, to], got ${Array.isArray(t) ? `${t.length} elements` : typeof t}`,
        path: [...ctx.path, ctx.config.key],
      });
    }
  }
  return issues;
}

export function stateRefFormat(ctx: RuleContext): ValidationIssue[] {
  const transitions = ctx.config.transitions;
  if (!transitions) return [];
  const issues: ValidationIssue[] = [];
  for (const t of transitions) {
    if (!Array.isArray(t) || t.length !== 3) continue;
    const [from, , to] = t;
    for (const ref of [from, to]) {
      if (ref === "" || ref === "*") continue;
      if (typeof ref !== "string" || !STATE_KEY_PATTERN.test(ref)) {
        issues.push({
          rule: "L4",
          severity: "warning",
          message: `State reference "${ref}" does not match expected format`,
          path: [...ctx.path, ctx.config.key],
        });
      }
    }
  }
  return issues;
}

export function eventRefFormat(ctx: RuleContext): ValidationIssue[] {
  const transitions = ctx.config.transitions;
  if (!transitions) return [];
  const issues: ValidationIssue[] = [];
  for (const t of transitions) {
    if (!Array.isArray(t) || t.length !== 3) continue;
    const event = t[1];
    if (event === "*" || event === "") continue;
    if (typeof event !== "string" || !EVENT_KEY_PATTERN.test(event)) {
      issues.push({
        rule: "L5",
        severity: "warning",
        message: `Event reference "${event}" does not follow camelCase convention`,
        path: [...ctx.path, ctx.config.key],
      });
    }
  }
  return issues;
}

export function eventsArrayFormat(ctx: RuleContext): ValidationIssue[] {
  const events = ctx.config.events;
  if (!events) return [];
  const issues: ValidationIssue[] = [];
  for (const e of Object.keys(events)) {
    if (!EVENT_KEY_PATTERN.test(e)) {
      issues.push({
        rule: "L6",
        severity: "warning",
        message: `Event "${e}" in events does not follow camelCase convention`,
        path: [...ctx.path, ctx.config.key],
      });
    }
  }
  return issues;
}

export function noDuplicateSiblingKeys(ctx: RuleContext): ValidationIssue[] {
  const states = ctx.config.states;
  if (!states || states.length === 0) return [];
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const child of states) {
    if (seen.has(child.key)) {
      issues.push({
        rule: "L7",
        severity: "error",
        message: `Duplicate sibling state key "${child.key}"`,
        path: [...ctx.path, ctx.config.key],
      });
    }
    seen.add(child.key);
  }
  return issues;
}

export const lexicalRules: [RuleId, RuleFunction][] = [
  ["L1", keyRequired],
  ["L2", stateKeyFormat],
  ["L3", transitionTupleLength],
  ["L4", stateRefFormat],
  ["L5", eventRefFormat],
  ["L6", eventsArrayFormat],
  ["L7", noDuplicateSiblingKeys],
];
