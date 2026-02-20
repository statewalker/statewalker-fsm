import type {
  RuleContext,
  RuleFunction,
  RuleId,
  ValidationIssue,
} from "../types.ts";

export function initialTransitionRequired(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states || config.states.length === 0) return [];

  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) {
    return [
      {
        rule: "S1",
        severity: "error",
        message: `Composite state "${config.key}" has sub-states but no transitions (missing initial transition)`,
        path: [...path, config.key],
      },
    ];
  }

  const childKeys = new Set(config.states.map((s) => s.key));
  const hasInitial = transitions.some(
    ([from, , to]) => from === "" && to !== "" && childKeys.has(to),
  );

  if (!hasInitial) {
    return [
      {
        rule: "S1",
        severity: "error",
        message: `Composite state "${config.key}" must have an initial transition ["", "*", <ChildState>]`,
        path: [...path, config.key],
      },
    ];
  }
  return [];
}

export function transitionsReferenceSiblings(
  ctx: RuleContext,
): ValidationIssue[] {
  const { config, path } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];
  if (!config.states || config.states.length === 0) return [];

  const siblingKeys = new Set(config.states.map((s) => s.key));
  const issues: ValidationIssue[] = [];

  for (const t of transitions) {
    if (!Array.isArray(t) || t.length !== 3) continue;
    const [from, , to] = t;

    if (from !== "" && from !== "*" && !siblingKeys.has(from)) {
      issues.push({
        rule: "S2",
        severity: "error",
        message: `Transition source "${from}" is not a sub-state of "${config.key}"`,
        path: [...path, config.key],
      });
    }
    if (to !== "" && to !== "*" && !siblingKeys.has(to)) {
      issues.push({
        rule: "S2",
        severity: "error",
        message: `Transition target "${to}" is not a sub-state of "${config.key}"`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

export function siblingTransitionsAtParent(
  _ctx: RuleContext,
): ValidationIssue[] {
  // S3: Advisory rule — hard to enforce statically without knowing intent.
  // A child state having transitions that reference its own siblings is normal
  // (those are the child's sub-state transitions). We cannot distinguish
  // "accidentally placed sibling transition" from "intended sub-state transition"
  // without deeper context. Returning empty.
  return [];
}

export function reachabilityFromInitial(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states || config.states.length === 0) return [];
  if (!config.transitions || config.transitions.length === 0) return [];

  const allKeys = new Set(config.states.map((s) => s.key));
  const reachable = new Set<string>();

  // Find initial targets (transitions from "")
  const queue: string[] = [];
  for (const [from, , to] of config.transitions) {
    if (from === "" && to !== "" && to !== "*") {
      queue.push(to);
    }
  }

  // Collect wildcard-source transitions (apply from any reachable state)
  const wildcardTargets: string[] = [];
  for (const [from, , to] of config.transitions) {
    if (from === "*" && to !== "" && to !== "*") {
      wildcardTargets.push(to);
    }
  }

  // BFS
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (reachable.has(current)) continue;
    reachable.add(current);

    // Follow standard transitions from current
    for (const [from, , to] of config.transitions) {
      if (from === current && to !== "" && to !== "*" && !reachable.has(to)) {
        queue.push(to);
      }
    }
    // Wildcard targets are reachable from any reachable state
    for (const wt of wildcardTargets) {
      if (!reachable.has(wt)) {
        queue.push(wt);
      }
    }
  }

  const issues: ValidationIssue[] = [];
  for (const key of allKeys) {
    if (!reachable.has(key)) {
      issues.push({
        rule: "S4",
        severity: "warning",
        message: `State "${key}" is unreachable from the initial transition`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

export function noDeadEnds(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states || config.states.length === 0) return [];
  if (!config.transitions || config.transitions.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Collect states that have outgoing transitions
  const hasOutgoing = new Set<string>();
  // States covered by wildcard source also have outgoing
  let hasWildcardSource = false;
  for (const [from] of config.transitions) {
    if (from === "*") {
      hasWildcardSource = true;
    } else if (from !== "") {
      hasOutgoing.add(from);
    }
  }

  if (hasWildcardSource) return []; // All states have outgoing via wildcard

  for (const child of config.states) {
    if (!hasOutgoing.has(child.key)) {
      // Check if it's a final state (has sub-states with exit transitions, or is a leaf terminal)
      const isComposite = child.states && child.states.length > 0;
      if (isComposite) {
        // Composite states without outgoing transitions at parent level are dead-ends
        issues.push({
          rule: "S5",
          severity: "warning",
          message: `State "${child.key}" has no outgoing transitions (dead-end)`,
          path: [...path, config.key],
        });
      }
      // Leaf states without outgoing transitions may be intentionally final
    }
  }
  return issues;
}

export function exitEventPropagation(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states || config.states.length === 0) return [];
  if (!config.transitions) return [];

  const issues: ValidationIssue[] = [];

  for (const child of config.states) {
    if (!child.transitions) continue;

    // Find exit transitions in child: [X, event, ""]
    const exitEvents = new Set<string>();
    for (const [, event, to] of child.transitions) {
      if (to === "" && event !== "*") {
        exitEvents.add(event);
      }
    }

    if (exitEvents.size === 0) continue;

    // Check if parent handles these events for this child
    for (const exitEvent of exitEvents) {
      const handled = config.transitions.some(
        ([from, event]) =>
          (from === child.key || from === "*") &&
          (event === exitEvent || event === "*"),
      );
      if (!handled) {
        issues.push({
          rule: "S6",
          severity: "info",
          message: `Child "${child.key}" exits with event "${exitEvent}" but parent "${config.key}" has no transition handling it`,
          path: [...path, config.key],
        });
      }
    }
  }
  return issues;
}

export function deterministicWildcards(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Build a map of (from, event) → targets
  const transitionMap = new Map<string, Map<string, Set<string>>>();

  for (const [from, event, to] of transitions) {
    if (!transitionMap.has(from)) transitionMap.set(from, new Map());
    const eventMap = transitionMap.get(from) as Map<string, Set<string>>;
    if (!eventMap.has(event)) eventMap.set(event, new Set());
    eventMap.get(event)?.add(to);
  }

  // Check for direct conflicts: same (from, event) → multiple targets
  for (const [from, eventMap] of transitionMap) {
    for (const [event, targets] of eventMap) {
      if (targets.size > 1) {
        issues.push({
          rule: "S7",
          severity: "warning",
          message: `Ambiguous transition: ["${from}", "${event}"] leads to multiple targets: ${[...targets].map((t) => `"${t}"`).join(", ")}`,
          path: [...path, config.key],
        });
      }
    }
  }

  return issues;
}

export function noCrossLevelJumps(_ctx: RuleContext): ValidationIssue[] {
  // S8: Subsumed by S2 (transitionsReferenceSiblings).
  // S2 already ensures all transition refs are direct children.
  return [];
}

export function leafStatesDeclareEvents(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  const isLeaf = !config.states || config.states.length === 0;
  if (!isLeaf) return [];
  if (config.events) return [];

  // Only report if we're not the root (root is typically composite)
  if (!ctx.parent) return [];

  return [
    {
      rule: "S9",
      severity: "info",
      message: `Leaf state "${config.key}" does not declare an events field`,
      path: [...path, config.key],
    },
  ];
}

export const structuralRules: [RuleId, RuleFunction][] = [
  ["S1", initialTransitionRequired],
  ["S2", transitionsReferenceSiblings],
  ["S3", siblingTransitionsAtParent],
  ["S4", reachabilityFromInitial],
  ["S5", noDeadEnds],
  ["S6", exitEventPropagation],
  ["S7", deterministicWildcards],
  ["S8", noCrossLevelJumps],
  ["S9", leafStatesDeclareEvents],
];
