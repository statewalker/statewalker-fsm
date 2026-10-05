# @statewalker/fsm-validator

## What it is: 25 checks for HFSM configurations, run before the machine runs

A validation library for hierarchical finite state machine (HFSM) configurations in the
`{ key, transitions, states }` format that `@statewalker/fsm` runs. It applies **25
rules** in three tiers (lexical, structural, semantic) and reports errors, warnings,
advisory hints, and items that need human review. It also exports the rule catalog and
prompt texts for AI agents that write HFSM configurations. Zero runtime dependencies.

## Why it exists: the runtime accepts broken configurations silently

`@statewalker/fsm` does not check a configuration. When a transition names a state that
no enclosing scope defines, the engine creates an empty state with no transitions and
carries on; an event with no matching rule makes the current state exit. A typo in a
state key therefore shows up as a machine that stalls or exits early, not as an error.
This package finds those problems (and naming, reachability and event-coverage problems)
from the configuration alone, before anything runs. Configurations written by AI agents
are the main case: the [`agent-rules/`](./agent-rules/) material tells an agent how to
write a configuration, and `validate` checks the result.

## How to use: call `validate(config)` and read `errors`

```bash
pnpm add @statewalker/fsm-validator
```

No peer or runtime dependencies. ESM only; no DOM or Node-specific APIs, so it runs in
browsers, Node.js and workers.

### The package root is the only entry point

| Import | What it gives |
|--------|---------------|
| `@statewalker/fsm-validator` | Everything: `validate`, `allRules`, the report helpers, the rule definitions and the agent prompt texts, plus the types. Built to `dist/index.js` with `.d.ts` types; sources are published in `src/`. |

Subpath imports fail; see [Internals](#internals-a-per-state-walk-with-lexical-key-resolution).

### `validate(config, options?)` returns a `ValidationResult`

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

Pass `options.rules` to run only the listed rule ids, or `options.exclude` to skip some.

### The configuration format

The validator defines its own `FsmStateConfig` type, a superset of the one `@statewalker/fsm` runs (the extra fields are descriptive and used by the semantic rules):

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

## Examples

### Validate a configuration

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

### Run a subset of rules

Run only specific rules or exclude rules you don't need:

```typescript
// Run only lexical rules L1 and L3
const result = validate(config, { rules: ["L1", "L3"] });

// Run everything except complexity advisory
const result = validate(config, { exclude: ["M7"] });
```

### Review items need a person

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

### Build a report

`buildReport(result, rules)` groups the issues of a `ValidationResult` by category and
rule, using rule definitions (names and constraints) from `ruleDefinitions`.
`formatReport` turns the report into a plain-text listing; `formatReportCompact` gives a
short Markdown form with errors and warnings in a table and review items in a collapsed
`<details>` block.

```typescript
import {
  buildReport,
  formatReport,
  formatReportCompact,
  ruleDefinitions,
  validate,
} from "@statewalker/fsm-validator";

const report = buildReport(validate(config), ruleDefinitions);
console.log(report.summary); // { total, errors, warnings, info, review }
console.log(formatReport(report));
console.log(formatReportCompact(report)); // e.g. "**PASS** 6R" followed by the review table
```

### Use the rule catalog

`ruleDefinitions` lists all 25 rules as `{ category, ruleId, rule, severity, constraint }`
(the same data as [rules.json](./agent-rules/rules.json)). `lexicalRules`,
`structuralRules` and `semanticRules` are the same list filtered by category.
`getRulesByIds(ids)` picks rules by id, and `formatRulesAsText(rules)` renders them as
text for a prompt.

```typescript
import { formatRulesAsText, getRulesByIds, structuralRules } from "@statewalker/fsm-validator";

console.log(structuralRules.length); // 9
console.log(formatRulesAsText(getRulesByIds(["S1", "S2"])));
```

### Use the agent prompt texts

The prompt material from [`agent-rules/`](./agent-rules/) is also exported as strings:
`dataModel`, `outputFormat`, `transitionPatterns`, `namingRules`, `structureRules`,
`eventConsistencyRules`, `semanticConsistencyRules`, `transformationMethodology`,
`namingConventions`, `commonMistakes`, and `examples` (`lightBulb`, `ticketFlow`).
`prompts` holds pre-composed sections for three use cases: `generation`, `validation` and
`refinement`.

```typescript
import { examples, prompts } from "@statewalker/fsm-validator";

const systemPrompt = prompts.generation; // one string: data model, format, rules, examples
console.log(examples.lightBulb); // a YAML example configuration
```

### Call rule functions directly

The rule map is exported for advanced use cases (custom orchestration, tooling integration):

```typescript
import { allRules } from "@statewalker/fsm-validator";

// allRules is Map<RuleId, RuleFunction>
for (const [id, fn] of allRules) {
  console.log(id); // "L1", "L2", ..., "M8", "M9"
}
```

## Rule reference

For the full specification see [rules.md](./agent-rules/rules.md).

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
| S1 | error | Composite states must have an initial transition `["", "*", X]`, X resolving here or in an ancestor |
| S2 | error | Every transition key resolves — in the declaring state's `states[]` or an ancestor's |
| S3 | error | Sibling transitions must be at parent level — unless the child is instantiating a shared definition |
| S4 | error | All sub-states reachable from the initial transition, or referenced by a descendant scope (a shared definition) |
| S5 | warning | Non-final sub-states must have at least one outgoing transition |
| S6 | error | Exit events from sub-states must be handled at parent level |
| S7 | warning | Wildcard transitions must not create ambiguity |
| S8 | error | Leaf states — driving no `states[]` and no `transitions[]` — must declare `events` |
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

## Internals: a per-state walk with lexical key resolution

- **Walk.** `validate` visits every state depth-first. Each active rule is a function of a
  `RuleContext` (`config`, `path`, `root`, `parent`, `ancestors`) and returns issues for
  that state. `allRules` maps rule ids to these functions in L, S, M order.
- **Key resolution is lexical, as in the engine.** A transition target resolves to the
  nearest definition in the declaring state's `states` or in an ancestor's. That is the
  only way to share a sub-machine between scopes, so S2, S3 and S4 accept a key that is
  defined by an ancestor instead of flagging it.
- **Only errors make a configuration invalid.** `valid` is `errors.length === 0`;
  warnings, info and review items never change it.
- **Constraint: subpath imports do not work.** `package.json` declares a `./*` export, but
  the build emits only `dist/index.js`. An import such as
  `@statewalker/fsm-validator/validate` fails with
  `ERR_MODULE_NOT_FOUND ... Cannot find module '.../dist/validate.js'`. Import from the
  package root.
- **Dependencies.** None. Zero runtime dependencies; the configuration type is defined
  locally, so validating does not require the runtime.

## Reference

### AI agent resources

The [`agent-rules/`](./agent-rules/) folder contains everything an AI agent needs to generate and validate HFSM definitions:

| File | Purpose |
|------|---------|
| [instructions.md](./agent-rules/instructions.md) | AI agent prompt — how to transform human-readable text into HFSM definitions: step-by-step methodology, data model, output format, transition patterns, naming conventions, and examples |
| [validation.md](./agent-rules/validation.md) | Post-generation checklist organized by category (structural, naming, event consistency, cycles, semantic review) with rule ID cross-references |
| [rules.md](./agent-rules/rules.md) | Full formalized rule specification with pseudocode, examples, and constraint details |
| [rules.json](./agent-rules/rules.json) | Machine-readable rule catalog — category, ruleId, severity, and constraint for all 25 rules |

### Development commands

```bash
pnpm install       # at the repository root
pnpm test          # run all tests
pnpm build         # run tests, then bundle with tsdown (ESM + .d.ts)
pnpm check         # biome lint
pnpm format        # biome format
```

## License

MIT
