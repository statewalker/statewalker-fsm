# @statewalker/fsm-validator

Standalone validation library for **Hierarchical Finite State Machine** (HFSM) configurations used in the [StateWalker](https://github.com/statewalker) ecosystem.

Implements **24 rules** across three tiers — lexical, structural, and semantic — to catch configuration errors, suspicious patterns, and conditions requiring human review. Zero runtime dependencies.

For the full rule specification see [rules.md](./agent-rules/rules.md).

## AI agent resources

The [`agent-rules/`](./agent-rules/) folder contains everything an AI agent needs to generate and validate HFSM definitions:

| File | Purpose |
|------|---------|
| [instructions.md](./agent-rules/instructions.md) | AI agent prompt — how to transform human-readable text into HFSM definitions: step-by-step methodology, data model, output format, transition patterns, naming conventions, and examples |
| [validation.md](./agent-rules/validation.md) | Post-generation checklist organized by category (structural, naming, event consistency, cycles, semantic review) with rule ID cross-references |
| [rules.md](./agent-rules/rules.md) | Full formalized rule specification with pseudocode, examples, and constraint details |
| [rules.json](./agent-rules/rules.json) | Machine-readable rule catalog — category, ruleId, severity, and constraint for all 24 rules |

## Installation

```bash
npm install @statewalker/fsm-validator
# or
pnpm add @statewalker/fsm-validator
```

## Quick start

```typescript
import { validate } from "@statewalker/fsm-validator";

const config = {
  key: "LightBulb",
  description: "A simple on/off light bulb",
  transitions: [
    ["", "*", "Off"],
    ["Off", "toggle", "On"],
    ["On", "toggle", "Off"],
    ["*", "burnOut", ""],
  ],
  states: [
    {
      key: "Off",
      description: "Light is off",
      events: {
        toggle: "When user presses the light switch",
        burnOut: "When the bulb fails due to age or damage",
      },
    },
    {
      key: "On",
      description: "Light is on",
      events: {
        toggle: "When user presses the light switch",
        burnOut: "When the bulb fails due to age or damage",
      },
    },
  ],
};

const result = validate(config);

console.log(result.valid);    // true
console.log(result.errors);   // [] — severity "error"
console.log(result.warnings); // [] — severity "warning"
console.log(result.review);   // [...] — conditions requiring human review
console.log(result.issues);   // all issues (errors + warnings + info + review)
```

## Selective validation

Run only specific rules or exclude rules you don't need:

```typescript
// Run only lexical rules L1 and L3
const result = validate(config, { rules: ["L1", "L3"] });

// Run everything except complexity advisory
const result = validate(config, { exclude: ["M7"] });
```

## Validation result

```typescript
type ValidationResult = {
  valid: boolean;              // true when zero errors
  issues: ValidationIssue[];   // all issues
  errors: ValidationIssue[];   // severity === "error"
  warnings: ValidationIssue[]; // severity === "warning"
  review: ValidationIssue[];   // severity === "review"
};

type ValidationIssue = {
  rule: RuleId;       // e.g. "L1", "S2", "M5", "M8"
  severity: Severity; // "error" | "warning" | "info" | "review"
  message: string;    // human-readable description
  path: string[];     // ancestor keys leading to the state, e.g. ["Root", "Handle"]
};
```

- **Errors** — will break at runtime (missing keys, malformed transitions, dangling references)
- **Warnings** — likely bugs or bad practice (unreachable states, naming violations, missing event coverage)
- **Info** — advisory hints (complexity, missing event declarations)
- **Review** — conditions that require human judgment to verify (event-state consistency, goal alignment, convergent transitions)

Only errors affect the `valid` flag. Warnings, info, and review issues are reported but don't make the config invalid.

## Configuration type

The validator uses a self-contained `FsmStateConfig` type (no dependency on `@statewalker/fsm`):

```typescript
type FsmStateConfig = {
  key: string;                              // state identifier (mandatory)
  name?: string;                            // human-readable display name
  transitions?: [string, string, string][]; // [from, event, to] tuples
  states?: FsmStateConfig[];                // nested sub-states (recursive)
  events?: Record<string, string>;          // event name → description of when/how it occurs
  description?: string;                     // purpose & behavior of this state
  outcome?: string;                         // expected result upon completion
  roles?: string[];                         // roles required for this state
  object?: string;                          // primary entity acted upon
};
```

The `events` field is a key/value record where each key is the event name (camelCase) and each value describes the conditions when and how that event occurs. This enables semantic validation rules (M8, M9) to report event descriptions alongside state goals for human review.

## Rule overview

### Tier 1 — Lexical (L1–L7)

Format and naming validation applied to each state node individually.

| Rule | Severity | Check |
|------|----------|-------|
| L1 | error | `key` is mandatory and non-empty |
| L2 | warning | State key should be PascalCase |
| L3 | error | Each transition must be a 3-element array |
| L4 | warning | State references in transitions should match expected format |
| L5 | warning | Event references in transitions should be `"*"` or camelCase |
| L6 | warning | Event keys in `events` should be camelCase |
| L7 | error | No duplicate keys among sibling states |

### Tier 2 — Structural (S1–S9)

Graph topology validation — checks the transition graph is well-formed.

| Rule | Severity | Check |
|------|----------|-------|
| S1 | error | Composite states must have an initial transition `["", "*", X]` |
| S2 | error | Every transition key resolves — in the declaring state's `states[]` or an ancestor's |
| S3 | error | Sibling transitions must be at parent level, not inside children |
| S4 | error | All sub-states reachable from the initial transition, or referenced by a descendant scope (a shared definition) |
| S5 | warning | Non-final sub-states must have at least one outgoing transition |
| S6 | error | Exit events from sub-states must be handled at parent level |
| S7 | warning | Wildcard transitions must not create ambiguity |
| S8 | error | Leaf states must declare `events` |
| S9 | warning | A key defined at several depths shadows the outer definition — keep it deliberate |

### Tier 3 — Semantic (M1–M9)

Consistency, completeness, and semantic review rules.

| Rule | Severity | Check |
|------|----------|-------|
| M1 | warning | Every event in `events` handled by some referencing scope, and every referencing scope handling some event |
| M2 | warning | Every transition event must exist in the source state's `events` |
| M3 | warning | Hierarchical event declaration — child exit events must be in child's `events` |
| M4 | **review** | Reports convergent transitions (same source, different events, same target) for human review |
| M5 | warning | Every cycle in the transition graph must have an exit |
| M6 | warning | Decision points should have exhaustive outgoing events |
| M7 | info | Manageable complexity: 3–7 sub-states per level |
| M8 | **review** | Event descriptions must not contradict state goals/outcomes — reports for human review |
| M9 | **review** | Child state goals should align with parent goals (or ancestor goals) — reports for human review |

See [rules.md](./agent-rules/rules.md) for the full specification with examples, pseudocode, and checklists.

## Review validation

Rules M4, M8, and M9 produce issues with `severity: "review"`. These are structural patterns detected by the validator that **cannot be verified programmatically** — they require human judgment.

The validator reports enough context in each issue message for a human reviewer to check:

- **M4**: "State X has 2 transitions to Y via events [ok, error]. Verify that these outcomes are semantically compatible"
- **M8**: "State X (description: ...) declares event Y described as '...'. Verify the event conditions do not contradict the state's goals"
- **M9**: "Child state X (description: ...) is nested in Y (description: ...). Verify child goals do not contradict parent goals"

```typescript
const result = validate(config);

// Check review issues that need human review
for (const issue of result.review) {
  console.log(`[${issue.rule}] ${issue.path.join(" > ")}: ${issue.message}`);
}
```

## Accessing individual rules

The rule map is exported for advanced use cases (custom orchestration, tooling integration):

```typescript
import { allRules } from "@statewalker/fsm-validator";

// allRules is Map<RuleId, RuleFunction>
for (const [id, fn] of allRules) {
  console.log(id); // "L1", "L2", ..., "M8", "M9"
}
```

## Development

```bash
pnpm install
pnpm test          # run all tests
pnpm build         # bundle with tsdown (ESM + .d.ts)
pnpm check         # biome lint
pnpm format        # biome format
```

## License

MIT
