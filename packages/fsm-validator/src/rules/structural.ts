import type {
  FsmStateConfig,
  RuleContext,
  RuleFunction,
  RuleId,
  ValidationIssue,
} from "../types.ts";
import {
  handlesEvent,
  instancesOf,
  isPseudoKey,
  referencingScopes,
  resolutionContexts,
  resolveDefinition,
} from "./resolution.ts";

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

  // The initial target need not be declared here: like any other transition
  // key it resolves up the live ancestor chain, so a composite state may enter
  // a shared definition as its initial sub-state. It counts when it resolves
  // where this state is entered; S2 reports each place it does not.
  const contexts = resolutionContexts(ctx);
  const initials = transitions.filter(
    ([from, , to]) =>
      from === "" &&
      to !== "" &&
      to !== "*" &&
      contexts.some((c) => !!resolveDefinition(to, config, c.ancestors)),
  );
  // The runtime picks the initial sub-state by the event that ENTERED this
  // state: ["", "start", X] fires only when the state is entered by "start".
  // Only a ["", "*", X] entry guarantees the state is ever entered at all.
  const defaults = initials.filter(([, event]) => event === "*");

  if (defaults.length === 0) {
    const specific = initials.map(([, event]) => `"${event}"`);
    return [
      {
        rule: "S1",
        severity: "error",
        message:
          specific.length > 0
            ? `Composite state "${config.key}" must have an initial transition ["", "*", <ChildState>] — its initial transitions only fire when it is entered by ${specific.join(", ")}`
            : `Composite state "${config.key}" must have an initial transition ["", "*", <ChildState>]`,
        path: [...path, config.key],
      },
    ];
  }
  if (defaults.length > 1) {
    return [
      {
        rule: "S1",
        severity: "error",
        message: `Composite state "${config.key}" has ${defaults.length} initial transitions ["", "*", X] — exactly one is allowed (targets: ${defaults.map(([, , to]) => `"${to}"`).join(", ")})`,
        path: [...path, config.key],
      },
    ];
  }
  return [];
}

/**
 * S2 — every state key a transition names must RESOLVE.
 *
 * Not "must be a direct sub-state": the engine looks the key up in this
 * state's `states:` and then in each RUNNING ancestor's, taking the first hit,
 * so a scope may legitimately reference a definition several levels above it,
 * or one that only the scope entering it defines. The key must resolve in
 * every place the state is entered: where no ancestor on that live chain
 * defines it, the engine reports nothing, creates an empty state and stalls.
 * Reported at the live path of each such place.
 */
export function transitionKeysResolve(ctx: RuleContext): ValidationIssue[] {
  const { config } = ctx;
  const transitions = config.transitions;
  if (!transitions || transitions.length === 0) return [];

  const issues: ValidationIssue[] = [];
  for (const context of resolutionContexts(ctx)) {
    const unresolved = (key: string) =>
      !isPseudoKey(key) && !resolveDefinition(key, config, context.ancestors);
    const path = [...context.path, config.key];
    const where =
      context.ancestors.length > 0
        ? `nor in any ancestor's when entered at "${path.join("/")}"`
        : "nor in any ancestor's";

    for (const t of transitions) {
      if (!Array.isArray(t) || t.length !== 3) continue;
      const [from, , to] = t;

      if (unresolved(from)) {
        issues.push({
          rule: "S2",
          severity: "error",
          message: `Transition source "${from}" does not resolve — "${from}" is defined neither in "${config.key}"'s states: ${where}`,
          path,
        });
      }
      if (unresolved(to)) {
        issues.push({
          rule: "S2",
          severity: "error",
          message: `Transition target "${to}" does not resolve — "${to}" is defined neither in "${config.key}"'s states: ${where}`,
          path,
        });
      }
    }
  }
  return issues;
}

/**
 * S9 — a key defined at more than one depth shadows the outer definition for
 * that subtree, much as a scoped variable does. Legal, and
 * occasionally what you want, but a reader now has to walk the ancestor chain
 * to know which definition applies.
 */
export function deliberateShadowing(ctx: RuleContext): ValidationIssue[] {
  const { config, path, ancestors } = ctx;
  if (!config.states || config.states.length === 0) return [];
  if (ancestors.length === 0) return [];

  const issues: ValidationIssue[] = [];
  for (const child of config.states) {
    const shadowed = ancestors.find((a) => a.states?.some((s) => s.key === child.key));
    if (shadowed) {
      issues.push({
        rule: "S9",
        severity: "warning",
        message: `State "${child.key}" defined in "${config.key}" shadows the definition of "${child.key}" in ancestor "${shadowed.key}"`,
        path: [...path, config.key],
      });
    }
  }
  return issues;
}

/**
 * S3 — a transition between two siblings belongs in their parent, never inside
 * one of them.
 *
 * The catch: "child A names its sibling B" and "child A instantiates the shared
 * definition B that happens to sit beside it" are the SAME structure. The engine
 * always does the second — a transition declared by A resolves B up the ancestor
 * chain and makes it a child of A, never a jump to A's sibling.
 *
 * The discriminator is A's own initial transition. A state that enters, as its
 * own initial sub-state, a key it does not define is unambiguously instantiating
 * a definition from an ancestor; its remaining transitions describe that borrowed
 * sub-machine, not sibling routing. Left alone, this rule would forbid the only
 * way the engine offers to share a sub-machine.
 */
export function siblingTransitionsAtParent(ctx: RuleContext): ValidationIssue[] {
  const { config } = ctx;
  if (!config.transitions || config.transitions.length === 0) return [];

  const ownKeys = new Set((config.states ?? []).map((s) => s.key));
  const instantiatesSharedDefinition = config.transitions.some(
    ([from, , to]) => from === "" && to !== "" && to !== "*" && !ownKeys.has(to),
  );
  if (instantiatesSharedDefinition) return [];

  // Siblings are the sub-states of the scope that ENTERS this state at
  // runtime: its lexical parent for an ordinary state, each caller for a
  // shared one. Reported once per entering scope.
  const issues: ValidationIssue[] = [];
  const checked = new Set<FsmStateConfig>();
  for (const context of resolutionContexts(ctx)) {
    const parent = context.ancestors[0];
    if (!parent?.states || checked.has(parent)) continue;
    checked.add(parent);
    issues.push(...siblingReferences(config, parent, [...context.path, config.key]));
  }
  return issues;
}

function siblingReferences(
  config: FsmStateConfig,
  parent: FsmStateConfig,
  path: string[],
): ValidationIssue[] {
  if (!parent.states || !config.transitions) return [];
  // Collect sibling keys from parent's states (excluding this state itself)
  const siblingKeys = new Set(parent.states.map((s) => s.key).filter((k) => k !== config.key));
  if (siblingKeys.size === 0) return [];

  const issues: ValidationIssue[] = [];

  for (const t of config.transitions) {
    if (!Array.isArray(t) || t.length !== 3) continue;
    const [from, , to] = t;

    // Check if transition references a sibling key (not child's own sub-state)
    if (from !== "" && from !== "*" && siblingKeys.has(from)) {
      issues.push({
        rule: "S3",
        severity: "error",
        message: `Child "${config.key}" has a transition referencing sibling "${from}" — sibling transitions must be declared at the parent level`,
        path,
      });
    }
    if (to !== "" && to !== "*" && siblingKeys.has(to)) {
      issues.push({
        rule: "S3",
        severity: "error",
        message: `Child "${config.key}" has a transition targeting sibling "${to}" — sibling transitions must be declared at the parent level`,
        path,
      });
    }
  }
  return issues;
}

export function reachabilityFromInitial(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  if (!config.states || config.states.length === 0) return [];
  if (!config.transitions || config.transitions.length === 0) return [];

  // A child without a string key is L1's error; it has nothing to reach.
  const allKeys = new Set(
    config.states.map((s) => s.key).filter((k): k is string => typeof k === "string"),
  );
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

  // A definition no local transition targets is not automatically an error:
  // it may be a SHARED definition, instantiated by a descendant scope that
  // resolves the key up its live ancestor chain. Reachability is a property of
  // the instantiation site, not of the definition site. Only a definition the
  // runtime enters from nowhere else is genuinely dead.
  const issues: ValidationIssue[] = [];
  for (const key of allKeys) {
    if (reachable.has(key)) continue;
    const definition = config.states.find((s) => s.key === key);
    // This scope's own references do not rescue it — reachability here was
    // just computed from them. Only ANOTHER running scope whose lookup lands
    // on this definition makes it a shared one.
    const elsewhere = definition
      ? instancesOf(ctx.root, definition).filter((i) => i.ancestors[0] !== config)
      : [];
    if (elsewhere.length > 0) continue;
    issues.push({
      rule: "S4",
      severity: "error",
      message: `State "${key}" is unreachable from the initial transition`,
      path: [...path, config.key],
    });
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
    }
  }
  return issues;
}

/**
 * S6 — an event a child's sub-machine exits with (`[X, e, ""]`) must be
 * handled where the child is ENTERED. For an ordinary child that is the parent
 * defining it; a shared definition is checked against every scope that
 * instantiates it (as S4 and M1 do), not against the scope that holds the
 * definition and may never enter it.
 */
export function exitEventPropagation(ctx: RuleContext): ValidationIssue[] {
  const { config, root } = ctx;
  if (!config.states || config.states.length === 0) return [];

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

    // Check that every scope entering this child handles these events
    for (const scope of referencingScopes(root, child)) {
      for (const exitEvent of exitEvents) {
        if (handlesEvent(scope.config, child.key, exitEvent)) continue;
        issues.push({
          rule: "S6",
          severity: "error",
          message: `Child "${child.key}" exits with event "${exitEvent}" but parent "${scope.config.key}" has no transition handling it`,
          path: [...scope.path, scope.config.key],
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

export function leafStatesDeclareEvents(ctx: RuleContext): ValidationIssue[] {
  const { config, path } = ctx;
  // A state that declares transitions is composite even when it declares no
  // `states:` of its own — the sub-states it drives resolve to definitions
  // further up the chain. Only a state that drives nothing is a leaf.
  const isLeaf =
    (!config.states || config.states.length === 0) &&
    (!config.transitions || config.transitions.length === 0);
  if (!isLeaf) return [];
  if (config.events) return [];

  // Only report if we're not the root (root is typically composite)
  if (!ctx.parent) return [];

  return [
    {
      rule: "S8",
      severity: "error",
      message: `Leaf state "${config.key}" does not declare an events field`,
      path: [...path, config.key],
    },
  ];
}

export const structuralRules: [RuleId, RuleFunction][] = [
  ["S1", initialTransitionRequired],
  ["S2", transitionKeysResolve],
  ["S3", siblingTransitionsAtParent],
  ["S4", reachabilityFromInitial],
  ["S5", noDeadEnds],
  ["S6", exitEventPropagation],
  ["S7", deterministicWildcards],
  ["S8", leafStatesDeclareEvents],
  ["S9", deliberateShadowing],
];
