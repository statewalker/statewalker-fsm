# HFSM Agent Instructions

## Goal

Given a natural-language description of a process (a business workflow, a user journey, a support procedure, etc.), produce a structured, machine-readable HFSM configuration that accurately captures:

- every step of the process as a state with a clear purpose and expected outcome,
- every decision point and branch as named events and transitions,
- the hierarchical grouping of steps into phases and sub-phases,
- all entry points, exit conditions, and cycles.

## Expected outcome

A valid `FsmStateConfig` object (serialised as YAML) that passes all error/warning rules defined below and reports [review] rules for human verification (Lexical L1–L7, Structural S1–S8, Semantic M1–M9).

---

## Data model

```ts
type FsmStateConfig = {
  key: string;                           // PascalCase identifier (mandatory)
  name?: string;                         // human-readable display name
  description?: string;                  // purpose & behavior of this state
  outcome?: string;                      // expected result upon completion
  events?: Record<string, string>;       // event name → description of when/how it occurs
  transitions?: [string, string, string][]; // [from, event, to] tuples
  states?: FsmStateConfig[];             // nested sub-states (recursive)
  roles?: string[];                      // roles required for this state
  object?: string;                       // primary entity acted upon
};
```

Each state declares the events it **emits**. Events represent outcome-driven signals produced by the state.

## Output format (YAML)

```yaml
key: <ProcessKey>
name: <Human-readable process name>
description: <High-level process description>
outcome: <Expected result of the entire process>
roles:
  - <Role1>
  - <Role2>
object: <Primary entity acted upon>
transitions:
  - ["", "*", <InitialState>]
  - [<From>, <event>, <To>]
  - [<From>, <event>, ""]        # exit transition
states:
  - key: <StateKey>
    name: <Human-readable state name>
    description: <What this state does>
    outcome: <Expected result when complete>
    events:
      <eventName>: <When and how this event occurs>
    # If composite (has sub-states):
    transitions:
      - ["", "*", <InitialSubState>]
    states:
      - key: <SubStateKey>
        description: ...
        outcome: ...
        events: ...
```

## Transition patterns

| Pattern              | Name            | Meaning                                |
| -------------------- | --------------- | -------------------------------------- |
| `["", "*", "X"]`     | Initial         | Entry point: activate sub-state X      |
| `["A", "evt", "B"]`  | Standard        | A emits evt: go to sibling B           |
| `["*", "evt", "X"]`  | Wildcard source | From any state on evt: go to X         |
| `["A", "*", "X"]`    | Wildcard event  | From A on any event: go to X           |
| `["A", "evt", ""]`   | Exit            | A emits evt: exit parent scope         |
| `["*", "evt", ""]`   | Global exit     | Any state emits evt: exit parent       |

> `["", "*", X]` is a fixed idiom — the `*` is required syntax, not a meaningful wildcard.

> Specific transitions take priority over wildcards (see S7).

### Event propagation

When a sub-state exits via `[X, event, ""]`, the event propagates to the composite state's parent. The parent must consume this event with a transition `[CompositeKey, event, Y]`. This is the mechanism behind ancestor-level event handling referenced in rules M1 and M3.

---

## Rules

Severity levels: **error** — must fix; **warning** — should fix; **info** — advisory hint; **review** — requires human/AI review (not programmatically verifiable).

### Lexical rules (L1–L7)

* **L1** — Key is mandatory [error]
  Every state object MUST have a non-empty `key` field.

* **L2** — State keys are PascalCase [warning]
  `key` matches `/^[A-Z][a-zA-Z0-9]*$/`.

* **L3** — Transition is a 3-tuple [error]
  Each element of `transitions[]` is `[sourceRef, eventRef, targetRef]` with exactly 3 elements.

* **L4** — State reference values [warning]
  A source/target in a transition is one of:
  - `""` as source: denotes the initial (entry) pseudo-state
  - `""` as target: denotes exit from the current scope
  - `"*"`: wildcard (any state)
  - a valid state key

* **L5** — Event reference values [warning]
  An event in a transition is either `"*"` (wildcard) or a camelCase name matching `/^[a-z][a-zA-Z0-9]*$/`.

* **L6** — Event keys are camelCase [warning]
  Every key in the `events` record matches `/^[a-z][a-zA-Z0-9]*$/`.

* **L7** — No duplicate keys among siblings [error]
  Within a single `states[]` array, all `key` values are unique.

### Structural rules (S1–S8)

* **S1** — Initial transition required [error]
  If a state declares `states[]`, its `transitions[]` MUST contain exactly one entry `["", "*", X]` where X is a key of one of its direct sub-states.

* **S2** — Transitions reference only siblings [error]
  Every non-special (`""`, `"*"`) state key in `transitions[]` MUST match the `key` of a direct sub-state in the same parent's `states[]`. Cross-level references are therefore prohibited.

* **S3** — Sibling transitions at parent level [error]
  Transitions between sibling states are declared ONLY in the parent's `transitions[]`, never inside a child state.

* **S4** — Reachability [error]
  Every sub-state must be reachable from the initial transition via some chain of transitions in the parent's `transitions[]`.

* **S5** — No dead-ends (unless final) [warning]
  Every non-final sub-state must have at least one outgoing transition. A state is "final" if the parent's `transitions[]` contains an exit transition `[Key, event, ""]` for it.

* **S6** — Exit event propagation [error]
  If a composite state's `transitions[]` contains an exit `[X, event, ""]`, the composite state's own parent MUST have a transition `[CompositeKey, event, Y]` consuming that event. This rule does not apply when the composite state is the root process.

* **S7** — Determinism with wildcards [warning]
  Wildcard transitions must not create ambiguity. Specific transitions take priority over wildcards, but two wildcards covering the same (state, event) pair are invalid.

* **S8** — Events mandatory for leaf states [error]
  States without `states[]` (leaf states) MUST declare an `events` field.

### Semantic rules (M1–M9)

* **M1** — Forward event coverage [warning]
  Every event in a state's `events` MUST have a corresponding transition `[S, e, _]` in the parent's `transitions[]`, or be covered by a wildcard `[S, "*", _]` or `["*", e, _]` at the parent or ancestor level.

* **M2** — Reverse event coverage [warning]
  Every non-wildcard event in transition `[S, e, T]` MUST appear in state S's or one of its ancestor's `events` keys (unless S is `""` or `"*"`). The ancestor fallback applies when an event is declared at a shared ancestor level for reuse across multiple descendants, and no M3 override applies.

* **M3** — Hierarchical event declaration [warning]
  If a child state emits an event handled by an ancestor transition, that event MUST be explicitly listed in the child's `events`.

* **M4** — Convergent transition compatibility [review]
  When multiple transitions from the same source target the same state via different events, source outcomes must be semantically compatible. Reports convergent patterns for review.

* **M5** — Cycle break requirement [warning]
  Every cycle in the transition graph MUST have at least one exit event/transition to prevent infinite loops.

* **M6** — Decision point exhaustiveness [warning]
  Branching states should have mutually exclusive and collectively exhaustive outgoing events (all possible outcomes represented).

* **M7** — Manageable complexity [info]
  Each hierarchical level should contain 3–7 sub-states. Longer linear sequences should be decomposed into composite phases.

* **M8** — Event-state semantic consistency [review]
  All event descriptions (when and how they occur) MUST NOT contradict the goals and outcomes of the state declaring them. Reports each event description alongside state goals for review.

* **M9** — Parent-child goal alignment [review]
  Child goals SHOULD align with parent goals. If a child's goals necessarily differ from its immediate parent, they MUST align with an ancestor's goals. Reports parent-child pairs for review.

---

## Transformation methodology

### Step 1: Decompose into steps

Break the text into individual steps. For each step extract:

- **Action** — the main activity ("validate", "review", "process")
- **Role** — who performs it (if stated)
- **Object** — what is acted upon (if stated)
- **Conditions** — prerequisites for the step
- **Outcome** — the result when the step completes
- **Events** — outcome-driven signals that cause a transition to the next state

Use sequential indicators in the text ("first", "then", "after", "finally") to determine ordering.

### Step 2: Build hierarchy

Group related steps into logical phases. Each phase becomes a composite state with sub-states.

- Aim for 3–7 sub-states per level [M7]
- If a sequence has more than 7 steps at one level, decompose into composite phases
- Each composite state needs its own transitions and states

### Step 3: Identify branches and decision points

Look for conditional language ("if", "depending on", "either…or", "when X fails").

- Each branch outcome becomes a separate event
- Ensure outcomes are mutually exclusive and exhaustive — all possible paths are covered [M6]
- Each branch target must be a sibling state at the same level

### Step 4: Identify cycles and ensure exits

Look for repetition language ("retry", "try again", "repeat until", "review again", "reprocess").

- Model cycles as transitions that loop back to earlier sibling states
- Every cycle must have at least one exit event/transition to prevent infinite loops [M5]

### Step 5: Map outcomes to events and transitions

For each state:

1. Determine all possible outcomes
2. Name each outcome as a camelCase event
3. Write an event description: when and how this event occurs
4. Create a transition `[StateKey, event, TargetSibling]` in the parent's transitions
5. If the outcome exits the current scope, use `[StateKey, event, ""]` and ensure the parent handles it [S6]

### Step 6: Fill gaps and refine

- If the text is ambiguous, make reasonable assumptions and note them in state descriptions
- Verify every state is reachable and every non-final state has an outgoing transition [S4, S5]
- Verify every event in `events` has a matching transition in the parent [M1]
- Verify every transition event is declared in the source state's `events` [M2]
- Verify child exit events are declared in the child's `events` [M3]
- Verify leaf states (no sub-states) declare `events` [S8]
- Verify no duplicate keys among sibling states [L7]

### Step 7: Semantic review

- Verify event descriptions do not contradict the declaring state's goals and outcomes [M8]
- Verify child state goals align with parent goals (or with ancestor goals if contradicting parent) [M9]
- Review convergent transitions — same source, different events, same target — for semantic compatibility [M4]

---

## Naming conventions

- **State keys**: PascalCase, action-oriented (ProcessingOrder, ValidatingInput)
- **Event names**: camelCase (orderValid, paymentFailed, timeout)
- **Process keys**: PascalCase, business-workflow names (OrderFulfillment, UserRegistration)
- **Roles**: plain strings describing roles required for the state (Analyst, Validator, Researcher)
- **Object**: a noun phrase describing the primary entity acted upon (support ticket, purchase order)

---

## Examples

### Minimal: Light Bulb

```yaml
key: LightBulb
description: A simple on/off light bulb
transitions:
  - ["", "*", "Off"]
  - ["Off", "toggle", "On"]
  - ["On", "toggle", "Off"]
  - ["*", "burnOut", ""]
states:
  - key: Off
    description: Light is off
    events:
      toggle: When user presses the light switch
      burnOut: When the bulb fails due to age or damage
  - key: On
    description: Light is on
    events:
      toggle: When user presses the light switch
      burnOut: When the bulb fails due to age or damage
```

### Nested with exit propagation: Ticket Flow

```yaml
key: TicketFlow
name: Support Ticket Lifecycle
description: Support ticket lifecycle
outcome: Ticket is resolved and closed
roles:
  - Customer
  - L1 Agent
  - L2 Agent
object: support ticket
transitions:
  - ["", "*", "Handle"]
  - ["Handle", "resolved", "Closed"]
  - ["Closed", "done", ""]
states:
  - key: Handle
    description: Handle the support ticket
    outcome: Issue is diagnosed and resolved
    events:
      resolved: When the issue has been fully resolved
    transitions:
      - ["", "*", "Diagnose"]
      - ["Diagnose", "notResolved", "Escalate"]
      - ["Diagnose", "resolved", ""]
      - ["Escalate", "resolved", ""]
    states:
      - key: Diagnose
        description: Identify the issue
        outcome: Root cause is identified
        events:
          resolved: When the issue is identified and fixed
          notResolved: When the issue cannot be resolved at current level
      - key: Escalate
        description: Escalate to L2
        outcome: Issue is resolved by L2 team
        events:
          resolved: When L2 team resolves the issue
  - key: Closed
    description: Ticket is closed
    events:
      done: When closing procedures are complete
```

---

## Common mistakes

- Placing sibling transitions inside child states instead of the parent [S3]
- Missing initial transition `["", "*", X]` on composite states [S1]
- Cycles without exit events — infinite loops [M5]
- Decision points with missing outcomes — not all branches covered [M6]
- Events declared in `events` with no matching transition in parent [M1]
- Transition events not declared in source state's `events` [M2]
- Cross-level references — transitions pointing to non-sibling states [S2]
- Duplicate keys among sibling states [L7]
- Convergent transitions with incompatible outcomes (e.g., ok and error both leading to the same state) [M4]
- Leaf states without `events` declarations [S8]
- Event descriptions that contradict the state's goals [M8]
- Child state goals that contradict parent goals without ancestor alignment [M9]
- Ambiguous wildcard transitions covering the same (state, event) pair [S7]
