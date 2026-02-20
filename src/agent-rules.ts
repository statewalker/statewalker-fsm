import type { RuleId, Severity } from "./types.ts";

export type RuleDefinition = {
  category: "lexical" | "structural" | "semantic";
  ruleId: RuleId;
  rule: string;
  severity: Severity | null;
  constraint: string;
};

export const ruleDefinitions: RuleDefinition[] = [
  {
    category: "lexical",
    ruleId: "L1",
    rule: "key is mandatory",
    severity: "error",
    constraint: "Every state object MUST have a non-empty `key` field",
  },
  {
    category: "lexical",
    ruleId: "L2",
    rule: "State keys are PascalCase",
    severity: "warning",
    constraint: "`key` matches /^[A-Z][a-zA-Z0-9]*$/",
  },
  {
    category: "lexical",
    ruleId: "L3",
    rule: "Event names are camelCase",
    severity: "warning",
    constraint: "Event strings in transitions match /^[a-z][a-zA-Z0-9]*$/",
  },
  {
    category: "lexical",
    ruleId: "L4",
    rule: "Transition is a 3-tuple",
    severity: "error",
    constraint:
      "Each element of `transitions[]` is `[sourceRef, eventRef, targetRef]` with exactly 3 elements",
  },
  {
    category: "lexical",
    ruleId: "L5",
    rule: "State reference values",
    severity: "warning",
    constraint:
      'A source/target in a transition is one of: "" (initial/terminal), "*" (wildcard), or a valid state key',
  },
  {
    category: "lexical",
    ruleId: "L6",
    rule: "Event reference values",
    severity: "warning",
    constraint:
      'An event in a transition is either "*" (wildcard) or a camelCase event name',
  },
  {
    category: "lexical",
    ruleId: "L7",
    rule: "events keys are camelCase",
    severity: "warning",
    constraint:
      "Every key in the `events` record matches /^[a-z][a-zA-Z0-9]*$/",
  },
  {
    category: "lexical",
    ruleId: "L8",
    rule: "No duplicate keys among siblings",
    severity: "error",
    constraint: "Within a single `states[]` array, all `key` values are unique",
  },
  {
    category: "structural",
    ruleId: "S1",
    rule: "Initial transition required for composite states",
    severity: "error",
    constraint:
      'If a state declares `states[]`, its `transitions[]` MUST contain exactly one entry ["", "*", X] where X is a key of one of its direct sub-states',
  },
  {
    category: "structural",
    ruleId: "S2",
    rule: "Transitions reference only siblings",
    severity: "error",
    constraint:
      'Every non-special ("", "*") state key in `transitions[]` MUST match the `key` of a direct sub-state in the same parent\'s `states[]`',
  },
  {
    category: "structural",
    ruleId: "S3",
    rule: "Sibling transitions declared at parent level",
    severity: "info",
    constraint:
      "Transitions between sibling states are declared ONLY in the parent's `transitions[]`, never inside a child state (advisory)",
  },
  {
    category: "structural",
    ruleId: "S4",
    rule: "Reachability",
    severity: "warning",
    constraint:
      "Every sub-state must be reachable from the initial transition via some chain of transitions in the parent's `transitions[]`",
  },
  {
    category: "structural",
    ruleId: "S5",
    rule: "No dead-ends (unless final)",
    severity: "warning",
    constraint:
      'Every non-final sub-state must have at least one outgoing transition. A state is "final" only if it has an exit transition [Key, event, ""] or is intentionally terminal',
  },
  {
    category: "structural",
    ruleId: "S6",
    rule: "Exit event propagation",
    severity: "info",
    constraint:
      'If a sub-state has an exit transition [X, event, ""], the parent MUST have a transition [CompositeParent, event, Y] that consumes that event',
  },
  {
    category: "structural",
    ruleId: "S7",
    rule: "Determinism with wildcards",
    severity: "warning",
    constraint:
      "Wildcard transitions must not create ambiguity. Specific transitions take priority over wildcards, but two wildcards covering the same (state, event) pair are invalid",
  },
  {
    category: "structural",
    ruleId: "S8",
    rule: "No cross-level jumps",
    severity: null,
    constraint: "Subsumed by S2",
  },
  {
    category: "structural",
    ruleId: "S9",
    rule: "events mandatory for leaf states",
    severity: "info",
    constraint:
      "States without `states[]` (leaf states) SHOULD declare an `events` field",
  },
  {
    category: "semantic",
    ruleId: "M1",
    rule: "Forward event coverage (events to transitions)",
    severity: "warning",
    constraint:
      'Every event in state\'s `events` MUST have a corresponding transition [S.key, e, _] in the parent\'s `transitions[]`, or be covered by a wildcard [S.key, "*", _] or ["*", e, _] at the parent or ancestor level',
  },
  {
    category: "semantic",
    ruleId: "M2",
    rule: "Reverse event coverage (transitions to events)",
    severity: "warning",
    constraint:
      'Every non-wildcard event in transition [S, e, T] MUST appear in state S\'s `events` keys (unless S is "" or "*")',
  },
  {
    category: "semantic",
    ruleId: "M3",
    rule: "Hierarchical event declaration",
    severity: "info",
    constraint:
      "If a child state emits an event handled by an ancestor transition, that event MUST be explicitly listed in the child's `events`",
  },
  {
    category: "semantic",
    ruleId: "M4",
    rule: "Semantic compatibility of convergent transitions",
    severity: "semantic",
    constraint:
      "When multiple transitions from the same source target the same state via different events, source outcomes must be semantically compatible. Reports convergent patterns for human review",
  },
  {
    category: "semantic",
    ruleId: "M5",
    rule: "Cycle break requirement",
    severity: "warning",
    constraint:
      "Every cycle in the transition graph MUST have at least one exit event/transition. Cycles must provide: (a) a success/termination exit, (b) a failure/limit-exceeded exit",
  },
  {
    category: "semantic",
    ruleId: "M6",
    rule: "Decision point exhaustiveness",
    severity: "warning",
    constraint:
      "Branching states should have mutually exclusive and collectively exhaustive outgoing events (all possible outcomes represented)",
  },
  {
    category: "semantic",
    ruleId: "M7",
    rule: "Manageable complexity",
    severity: "info",
    constraint:
      "Each hierarchical level should contain 3-7 sub-states. Longer linear sequences should be decomposed into composite phases",
  },
  {
    category: "semantic",
    ruleId: "M8",
    rule: "Event-state semantic consistency",
    severity: "semantic",
    constraint:
      "All event descriptions (when and how they occur) MUST NOT contradict semantically the goals and outcomes of the state declaring them. Reports each event description alongside state goals for human review",
  },
  {
    category: "semantic",
    ruleId: "M9",
    rule: "Parent-child goal alignment",
    severity: "semantic",
    constraint:
      "Goals and outcomes of a child state SHOULD NOT contradict the goals and outcomes of the parent. If they do contradict, they should be aligned with goals of a grandparent/ancestor. Reports parent-child pairs for human review",
  },
];

export const lexicalRules = ruleDefinitions.filter(
  (r) => r.category === "lexical",
);
export const structuralRules = ruleDefinitions.filter(
  (r) => r.category === "structural",
);
export const semanticRules = ruleDefinitions.filter(
  (r) => r.category === "semantic",
);

export function getRulesByIds(ids: RuleId[]): RuleDefinition[] {
  return ruleDefinitions.filter((r) => ids.includes(r.ruleId));
}

export function formatRulesAsText(rules: RuleDefinition[]): string {
  return rules
    .map((r) => `[${r.ruleId}] ${r.rule} (${r.severity}): ${r.constraint}`)
    .join("\n");
}
