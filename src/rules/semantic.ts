import type {
  FsmStateConfig,
  RuleContext,
  RuleFunction,
  RuleId,
  ValidationIssue,
} from "../types.ts";

export function forwardEventCoverage(ctx: RuleContext): ValidationIssue[] {
  const { config, path, parent } = ctx;
  const events = config.events;
  if (!events || Object.keys(events).length === 0) return [];
  if (!parent) return [];

  const parentTransitions = parent.transitions;
  if (!parentTransitions) return [];

  const issues: ValidationIssue[] = [];

  for (const event of Object.keys(events)) {
    const handled = parentTransitions.some(
      ([from, evt]) =>
        (from === config.key || from === "*") && (evt === event || evt === "*"),
    );
    if (!handled) {
      issues.push({
        rule: "M1",
        severity: "warning",
        message: `Event "${event}" declared in "${config.key}" has no matching transition in parent "${parent.key}"`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

export function reverseEventCoverage(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];
  if (!config.states || config.states.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Build a map of child key → event keys set
  const childEventsMap = new Map<string, Set<string>>();
  let anyChildHasEvents = false;
  for (const child of config.states) {
    if (child.events) {
      childEventsMap.set(child.key, new Set(Object.keys(child.events)));
      anyChildHasEvents = true;
    }
  }

  // Only validate if at least one child declares events
  if (!anyChildHasEvents) return [];

  for (const [from, event] of transitions) {
    if (from === "" || from === "*") continue;
    if (event === "*") continue;

    const childEvents = childEventsMap.get(from);
    if (childEvents && !childEvents.has(event)) {
      issues.push({
        rule: "M2",
        severity: "warning",
        message: `Transition event "${event}" from "${from}" is not declared in "${from}"'s events`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

export function hierarchicalEventDeclaration(
  ctx: RuleContext,
): ValidationIssue[] {
  const { config, path, parent } = ctx;
  if (!parent || !config.events) return [];

  // Check if any of this state's events are handled by a grandparent (or higher)
  // rather than the direct parent. This is informational.
  const parentTransitions = parent.transitions;
  if (!parentTransitions) return [];

  const issues: ValidationIssue[] = [];

  // Find events from child's sub-states that exit to parent level
  if (config.transitions && config.states) {
    for (const [, event, to] of config.transitions) {
      if (to === "" && event !== "*") {
        // This event exits to parent scope — check if parent handles it
        const handled = parentTransitions.some(
          ([from, evt]) =>
            (from === config.key || from === "*") &&
            (evt === event || evt === "*"),
        );
        if (!handled) {
          issues.push({
            rule: "M3",
            severity: "warning",
            message: `Exit event "${event}" from "${config.key}" sub-states is not handled by parent "${parent.key}"`,
            path: [...path, config.key],
          });
        }
      }
    }
  }
  return issues;
}

export function semanticCompatibility(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];

  // Detect convergent transitions: multiple different sources leading to the
  // same target via different events. This requires human review to verify
  // that the source outcomes are semantically compatible.
  const targetSources = new Map<string, { from: string; event: string }[]>();

  for (const [from, event, to] of transitions) {
    if (from === "" || to === "" || to === "*") continue;
    if (!targetSources.has(to)) targetSources.set(to, []);
    targetSources.get(to)?.push({ from, event });
  }

  const issues: ValidationIssue[] = [];
  for (const [target, sources] of targetSources) {
    if (sources.length < 2) continue;

    // Check if multiple transitions from the SAME source with different events
    // converge to the same target — these are the most likely semantic conflicts
    const fromGroups = new Map<string, string[]>();
    for (const { from, event } of sources) {
      if (!fromGroups.has(from)) fromGroups.set(from, []);
      fromGroups.get(from)?.push(event);
    }

    for (const [from, events] of fromGroups) {
      if (events.length < 2) continue;
      issues.push({
        rule: "M4",
        severity: "review",
        message: `State "${from}" has ${events.length} transitions to "${target}" via events [${events.join(", ")}]. Verify that these outcomes are semantically compatible`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

export function cycleBreakRequirement(ctx: RuleContext): ValidationIssue[] {
  const { config, path, parent } = ctx;
  // Root-level cycles are valid (machine exit is external)
  if (!parent) return [];
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];
  if (!config.states || config.states.length === 0) return [];

  const childKeys = new Set(config.states.map((s) => s.key));
  const issues: ValidationIssue[] = [];

  // Build adjacency list (only concrete state→state edges)
  const adj = new Map<string, Set<string>>();
  for (const key of childKeys) {
    adj.set(key, new Set());
  }

  for (const [from, , to] of transitions) {
    if (from === "" || to === "") continue;

    if (from === "*") {
      // Wildcard source: edge from every state to 'to'
      for (const key of childKeys) {
        if (to !== "*" && to !== key) adj.get(key)?.add(to);
      }
    } else if (childKeys.has(from) && to !== "*" && childKeys.has(to)) {
      adj.get(from)?.add(to);
    }
  }

  // Detect cycles using DFS with coloring
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const key of childKeys) color.set(key, WHITE);

  const cycleNodes = new Set<string>();

  function dfs(node: string, stack: string[]): boolean {
    color.set(node, GRAY);
    stack.push(node);

    let hasCycle = false;
    for (const neighbor of adj.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        // Found a cycle — collect all nodes in the cycle
        const cycleStart = stack.indexOf(neighbor);
        for (let i = cycleStart; i < stack.length; i++) {
          cycleNodes.add(stack[i]);
        }
        hasCycle = true;
      } else if (color.get(neighbor) === WHITE) {
        if (dfs(neighbor, stack)) hasCycle = true;
      }
    }

    stack.pop();
    color.set(node, BLACK);
    return hasCycle;
  }

  for (const key of childKeys) {
    if (color.get(key) === WHITE) {
      dfs(key, []);
    }
  }

  if (cycleNodes.size === 0) return issues;

  // Check if the cycle has at least one exit: a transition from a cycle node to ""
  let hasExit = false;
  for (const [from, , to] of transitions) {
    if (to === "" && (cycleNodes.has(from) || from === "*")) {
      hasExit = true;
      break;
    }
  }

  // Also check if there is a transition from a cycle node to a non-cycle node
  if (!hasExit) {
    for (const [from, , to] of transitions) {
      if (
        cycleNodes.has(from) &&
        to !== "" &&
        to !== "*" &&
        !cycleNodes.has(to)
      ) {
        hasExit = true;
        break;
      }
    }
  }

  if (!hasExit) {
    issues.push({
      rule: "M5",
      severity: "warning",
      message: `Cycle detected among states [${[...cycleNodes].join(", ")}] with no exit transition`,
      path: [...path, config.key],
    });
  }

  return issues;
}

export function decisionPointExhaustiveness(
  ctx: RuleContext,
): ValidationIssue[] {
  const { config, path } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];
  if (!config.states || config.states.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Build map of from-state → set of events
  const outgoingEvents = new Map<string, Set<string>>();
  const wildcardSourceEvents = new Set<string>();
  let hasWildcardEvent = false;

  for (const [from, event] of transitions) {
    if (from === "") continue;
    if (event === "*") {
      hasWildcardEvent = true;
      continue;
    }
    if (from === "*") {
      wildcardSourceEvents.add(event);
      continue;
    }
    if (!outgoingEvents.has(from)) outgoingEvents.set(from, new Set());
    outgoingEvents.get(from)?.add(event);
  }

  if (hasWildcardEvent) return []; // Wildcard catches everything

  // For each child with declared events, check coverage
  for (const child of config.states) {
    if (!child.events) continue;
    const eventKeys = Object.keys(child.events);
    if (eventKeys.length === 0) continue;

    const outgoing = outgoingEvents.get(child.key);
    if (!outgoing && wildcardSourceEvents.size === 0) continue;

    // Check if child has a wildcard-event transition
    const childHasWildcard = transitions.some(
      ([from, event]) => from === child.key && event === "*",
    );
    if (childHasWildcard) continue;

    const uncovered = eventKeys.filter(
      (e) => !(outgoing?.has(e) ?? false) && !wildcardSourceEvents.has(e),
    );
    if (uncovered.length > 0) {
      issues.push({
        rule: "M6",
        severity: "warning",
        message: `State "${child.key}" declares events [${uncovered.join(", ")}] with no matching transitions`,
        path: [...path, config.key],
      });
    }
  }

  return issues;
}

export function manageableComplexity(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states) return [];

  const count = config.states.length;
  if (count >= 2 && count <= 7) return [];

  if (count > 7) {
    return [
      {
        rule: "M7",
        severity: "info",
        message: `State "${config.key}" has ${count} sub-states (recommended: 3-7). Consider decomposing into composite phases`,
        path: [...path, config.key],
      },
    ];
  }

  if (count === 1) {
    return [
      {
        rule: "M7",
        severity: "info",
        message: `State "${config.key}" has only 1 sub-state. Consider flattening the hierarchy`,
        path: [...path, config.key],
      },
    ];
  }

  return [];
}

// ── M8: event-state semantic consistency ──────────────────────────────────
// Reports event descriptions alongside state descriptions/outcomes for human
// review. The validator cannot judge semantic consistency, but flags the
// relationships that need checking.

export function eventStateSemanticConsistency(
  ctx: RuleContext,
): ValidationIssue[] {
  const { config, path } = ctx;
  const events = config.events;
  if (!events) return [];

  const eventEntries = Object.entries(events);
  if (eventEntries.length === 0) return [];

  const stateDescription = config.description || config.outcome;
  if (!stateDescription) return [];

  const issues: ValidationIssue[] = [];

  for (const [eventName, eventDescription] of eventEntries) {
    if (!eventDescription) continue;
    issues.push({
      rule: "M8",
      severity: "review",
      message: `State "${config.key}" (${describeState(config)}) declares event "${eventName}" described as "${eventDescription}". Verify the event conditions do not contradict the state's goals and outcomes`,
      path: [...path, config.key],
    });
  }

  return issues;
}

// ── M9: parent-child goal alignment ───────────────────────────────────────
// Reports child state goals/outcomes alongside parent goals/outcomes for human
// review. Children should align with parent goals; if they contradict the
// parent, they should align with a grandparent/ancestor.

export function parentChildGoalAlignment(ctx: RuleContext): ValidationIssue[] {
  const { config, path, parent } = ctx;
  if (!parent) return [];

  const childDescription = config.description || config.outcome;
  if (!childDescription) return [];

  const parentDescription = parent.description || parent.outcome;
  if (!parentDescription) return [];

  return [
    {
      rule: "M9",
      severity: "review",
      message: `Child state "${config.key}" (${describeState(config)}) is nested in "${parent.key}" (${describeState(parent)}). Verify child goals do not contradict parent goals, or if they do, that they align with an ancestor's goals`,
      path: [...path, config.key],
    },
  ];
}

function describeState(config: FsmStateConfig): string {
  const parts: string[] = [];
  if (config.description) parts.push(`description: "${config.description}"`);
  if (config.outcome) parts.push(`outcome: "${config.outcome}"`);
  if (parts.length === 0) return "no description";
  return parts.join(", ");
}

export const semanticRules: [RuleId, RuleFunction][] = [
  ["M1", forwardEventCoverage],
  ["M2", reverseEventCoverage],
  ["M3", hierarchicalEventDeclaration],
  ["M4", semanticCompatibility],
  ["M5", cycleBreakRequirement],
  ["M6", decisionPointExhaustiveness],
  ["M7", manageableComplexity],
  ["M8", eventStateSemanticConsistency],
  ["M9", parentChildGoalAlignment],
];
