# HFSM Validation Rules — Formalized Reference

> Date: 2026-02-21
> Source: `src/agent-instructions.md`

This document formalizes the validation rules for Hierarchical Finite State Machine (HFSM) definitions used in StateWalker.

---

## Data Model

```typescript
type StateKey   = string;   // PascalCase: /^[A-Z][a-zA-Z0-9]*$/
type EventKey   = string;   // camelCase:  /^[a-z][a-zA-Z0-9]*$/

type StateRef = "" | "*" | StateKey;
type EventRef = "*" | EventKey;

type Transition = [source: StateRef, event: EventRef, target: "" | StateKey];

type FsmStateConfig = {
  key: StateKey;                          // mandatory
  name?: string;                          // human-readable display name
  description?: string;                   // purpose & behavior
  outcome?: string;                       // expected result upon completion
  events?: Record<EventKey, string>;      // events this state can emit, with descriptions
  roles?: string[];                       // roles required for this state
  object?: string;                        // primary entity acted upon
  transitions?: Transition[];             // rules between direct sub-states
  states?: FsmStateConfig[];              // nested sub-states (recursive)
};
```

The `events` field is a key/value record where:
- **key** — the event name (camelCase)
- **value** — a description of the conditions when and how this event occurs

---

## Severity Levels

| Level | Meaning | Affects `valid`? |
|-------|---------|-----------------|
| **error** | Will break at runtime | Yes |
| **warning** | Likely bug or bad practice | No |
| **info** | Advisory hint | No |
| **review** | Requires human semantic review | No |

**Review** issues are structural patterns detected by the validator that cannot be verified programmatically — they require human judgment to confirm correctness (e.g., whether event descriptions contradict state goals, or whether convergent transitions are intentional).

---

## Tier 1 — Lexical Rules (L1–L7)

| #  | Rule                          | Severity | Constraint |
|----|-------------------------------|----------|------------|
| L1 | `key` is mandatory            | error | Every state object MUST have a non-empty `key` field |
| L2 | State keys are PascalCase     | warning | `key` matches `/^[A-Z][a-zA-Z0-9]*$/` |
| L3 | Transition is a 3-tuple       | error | Each element of `transitions[]` is `[sourceRef, eventRef, targetRef]` with exactly 3 elements |
| L4 | State reference values        | warning | A source/target in a transition is one of: `""` as source (initial pseudo-state), `""` as target (exit from current scope), `"*"` (wildcard), or a valid state key |
| L5 | Event reference values        | warning | An event in a transition is either `"*"` (wildcard) or a camelCase name matching `/^[a-z][a-zA-Z0-9]*$/` |
| L6 | Event keys are camelCase      | warning | Every key in the `events` record matches `/^[a-z][a-zA-Z0-9]*$/` |
| L7 | No duplicate keys among siblings | error | Within a single `states[]` array, all `key` values are unique |

---

## Tier 2 — Structural Rules (S1–S9)

| #  | Rule                                          | Severity | Constraint |
|----|-----------------------------------------------|----------|------------|
| S1 | Initial transition required for composite states | error | If a state declares `states[]`, its `transitions[]` MUST contain exactly one entry `["", "*", X]` where `X` is a key of one of its direct sub-states |
| S2 | Transition keys resolve                        | error | Every non-special (`""`, `"*"`) state key in `transitions[]` MUST **resolve**: looked up in the declaring state's `states[]`, then in each ancestor's in turn, first definition wins. A key no ancestor defines is an error — the engine reports nothing, creates an empty state and silently stalls in it. This constrains where a key may be *defined*, not which states a transition may *connect* (see S3) |
| S3 | Sibling transitions declared at parent level   | error | Transitions between sibling states MUST be declared ONLY in the parent's `transitions[]`, never inside a child state |
| S4 | Reachability                                   | error | Every sub-state must be reachable from the initial transition via some chain of transitions in the parent's `transitions[]`. Checked at the **instantiation site**: a definition no local transition targets is not an error when another scope resolves the key up to it — that is a shared definition. A definition referenced from nowhere is dead and is reported |
| S5 | No dead-ends (unless final)                    | warning | Every non-final sub-state must have at least one outgoing transition. A state is "final" only if it has an exit transition `[Key, event, ""]` |
| S6 | Exit event propagation                         | error | If a composite state's `transitions[]` contains an exit `[X, event, ""]`, the composite state's own parent MUST have a transition `[CompositeKey, event, Y]` consuming that event. This rule does not apply when the composite state is the root process |
| S7 | Determinism with wildcards                     | warning | Wildcard transitions must not create ambiguity. Specific transitions take priority over wildcards, but two wildcards covering the same (state, event) pair are invalid |
| S8 | Events mandatory for leaf states               | error | States without `states[]` (leaf states) MUST declare an `events` field |
| S9 | Deliberate shadowing                          | warning | Where the same key is defined at more than one depth the nearest definition wins, shadowing the outer one for that subtree. Prefer distinct keys unless the shadowing is intentional and documented |

---

## Tier 3 — Semantic Rules (M1–M9)

| #  | Rule                                              | Severity | Constraint |
|----|---------------------------------------------------|----------|------------|
| M1 | Forward event coverage (events → transitions)    | warning | Every event in state's `events` MUST have a corresponding transition `[S, e, _]` in the parent's `transitions[]`, or be covered by a wildcard `[S, "*", _]` or `["*", e, _]` at the parent or ancestor level. Satisfied **per referencing scope**: a shared definition's `events` is the union across its callers, so each event must be handled by at least one referencing scope, and every referencing scope must handle at least one |
| M2 | Reverse event coverage (transitions → events)    | warning | Every non-wildcard event `e` in transition `[S, e, T]` MUST appear in state `S`'s `events` keys (unless `S` is `""` or `"*"`). If not found in the direct state, ancestor event declarations may satisfy this rule |
| M3 | Hierarchical event declaration                    | warning | If a child state emits an event handled by an ancestor transition, that event MUST be explicitly listed in the child's `events` |
| M4 | Convergent transition compatibility               | **review** | When multiple transitions from the same source target the same state via different events, source outcomes must be semantically compatible. Reports convergent patterns for review |
| M5 | Cycle break requirement                           | warning | Every cycle in the transition graph MUST have at least one exit event/transition to prevent infinite loops |
| M6 | Decision point exhaustiveness                     | warning | Branching states should have mutually exclusive and collectively exhaustive outgoing events (all possible outcomes represented) |
| M7 | Manageable complexity                             | info | Each hierarchical level should contain 3–7 sub-states. Longer linear sequences should be decomposed into composite phases |
| M8 | Event-state semantic consistency                  | **review** | All event descriptions (when and how they occur) MUST NOT contradict the goals and outcomes of the state declaring them. Reports each event description alongside state goals for review |
| M9 | Parent-child goal alignment                       | **review** | Child goals SHOULD align with parent goals. If a child's goals necessarily differ from its immediate parent, they MUST align with an ancestor's goals. Reports parent-child pairs for review |

---

## Transition Type Reference

| Pattern              | Name            | Meaning |
|----------------------|-----------------|---------|
| `["", "*", "X"]`     | Initial         | Entry point: activate sub-state `X` |
| `["A", "evt", "B"]`  | Standard        | `A` emits `evt`: transition to sibling `B` |
| `["*", "evt", "X"]`  | Wildcard source | From any state on `evt`: go to `X` |
| `["A", "*", "X"]`    | Wildcard event  | From `A` on any event: go to `X` |
| `["A", "evt", ""]`   | Exit            | `A` emits `evt`: exit parent scope |
| `["*", "evt", ""]`   | Global exit     | Any state emits `evt`: exit parent scope |

> `["", "*", X]` is a fixed idiom — the `*` is required syntax, not a meaningful wildcard.

> Specific transitions take priority over wildcards (see S7).

---

## Validation Algorithm (pseudocode)

```
VALIDATE(P):
  1. ASSERT P.key matches /^[A-Z][a-zA-Z0-9]*$/                    [L2]
  2. ASSERT all keys in P.states[] are unique                        [L7]

  IF P.states[] exists:
    3. ASSERT P.transitions[] contains exactly one ["", "*", X]      [S1]
       WHERE X in {s.key for s in P.states[]}

    4. FOR EACH transition [src, evt, tgt] in P.transitions[]:
       a. ASSERT length == 3                                         [L3]
       b. ASSERT src in {"", "*"} | RESOLVABLE(src, P)              [S2, L4]
       c. ASSERT tgt in {""} | RESOLVABLE(tgt, P)                   [S2, L4]
          WHERE RESOLVABLE(k, P) = k in {s.key for s in P.states[]}
                                   OR RESOLVABLE(k, parent-of P)
       d. ASSERT evt in {"*"} | /^[a-z][a-zA-Z0-9]*$/              [L5]

    5. FOR EACH state S in P.states[]:
       a. ASSERT S is reachable from initial transition,             [S4]
          OR some descendant scope resolves S.key up to this
          definition (a shared definition)
       b. ASSERT S has >= 1 outgoing transition OR exits to ""       [S5]

    6. FOR EACH leaf state S (S.states[] absent):
       a. ASSERT S.events is defined and non-empty                   [S8]
       b. FOR EACH e in keys(S.events):
          ASSERT exists transition [S.key, e, _] in P.transitions[]
            OR covered by wildcard [S.key, "*", _]
            OR covered by wildcard ["*", e, _]                       [M1]

    7. FOR EACH transition [S, e, _] where S != "" and S != "*":
       LET state = find(S in P.states[])
       IF state.events is defined:
         ASSERT e == "*" OR e in keys(state.events)                  [M2]

    8. FOR EACH child C in P.states[] where C.transitions[] exists:
       FOR EACH exit transition [X, e, ""] in C.transitions[]:
         ASSERT exists [C.key, e, _] in P.transitions[]              [S6]

    9. DETECT cycles in transition graph
       ASSERT each cycle has >= 1 exit event                         [M5]

   10. CHECK wildcard overlaps for ambiguity                         [S7]

   11. FOR EACH convergent transition pattern (same source → target
       via different events):
       REPORT for review                                             [M4]

   12. FOR EACH state with events and description/outcome:
       REPORT event descriptions vs state goals for review           [M8]

   13. FOR EACH child with description/outcome where parent also
       has description/outcome:
       REPORT parent-child goal pair for review                      [M9]

   14. RECURSE: FOR EACH S in P.states[]: VALIDATE(S)
```

---

## Validation Checklists

### Structural Checklist
- [ ] Every composite state has `["", "*", <InitialSubState>]`
- [ ] All sibling transitions are in the immediate parent's `transitions[]`
- [ ] Every state key in a transition resolves — in this state's `states[]` or an ancestor's
- [ ] Each non-final state has at least one outgoing transition
- [ ] All states are reachable from the initial transition, or referenced by a descendant scope as a shared definition
- [ ] Exit events from sub-states are captured at the parent level
- [ ] Wildcard use is intentional and non-ambiguous

### Event Consistency Checklist
- [ ] Every event in `events` has a matching transition in the parent
- [ ] Every transition event exists in the source state's `events`
- [ ] Child exit events are handled by parent transitions
- [ ] No dead events (declared but never used in transitions)
- [ ] No undeclared events (used in transitions but not in `events`)

### Semantic Review Checklist
- [ ] Event descriptions are consistent with the state's goals and outcomes
- [ ] Child state goals align with parent goals (or with ancestor goals if contradicting parent)
- [ ] Convergent transitions (same source → same target via different events) are intentional
- [ ] All cycles have at least one exit transition
- [ ] Decision points are mutually exclusive and exhaustive

### Complex Process Checklist
- [ ] Long processes decomposed into 3-7 states per level
- [ ] Sub-processes have clear entry/exit boundaries

### Field Completeness Checklist
- [ ] `key` present on every state (mandatory)
- [ ] `events` present on every leaf state (mandatory)
- [ ] Event descriptions explain when and how each event occurs
- [ ] `description` present (recommended)
- [ ] `outcome` present (recommended)
- [ ] `roles` and `object` defined where applicable (optional)

---

## Examples

### Valid: Light Bulb (minimal)

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

**Rules satisfied:** L1-L7, S1-S5, S8, M1-M2.

### Valid: Ticket Flow (exit propagation)

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

**Rules satisfied:** S1, S6 (Handle exit `resolved` caught by parent), S8, M1-M3.
**Semantic review (M8, M9):** Event descriptions and state goals reported for human verification.

### Invalid: Missing initial transition

```yaml
key: Light
transitions:
  - ["Off", "toggle", "On"]     # VIOLATION: no ["", "*", X]  -> fails S1
states:
  - key: Off
  - key: On
```

### Invalid: Sibling transition in child

```yaml
key: Light
states:
  - key: Off
    transitions:
      - ["Off", "toggle", "On"]  # VIOLATION: sibling transition in child -> fails S3
  - key: On
```

### Review: Convergent transitions (M4)

```yaml
transitions:
  - ["ValidateAccount", "ok", "HandleRequest"]
  - ["ValidateAccount", "error", "HandleRequest"]  # REVIEW: contradictory outcomes converging -> M4 flags for review
```

### Review: Event-state consistency (M8)

```yaml
key: Validate
description: Validate user input
outcome: Input is verified
events:
  valid: When all validation checks pass     # REVIEW: M8 reports for review
  invalid: When validation fails             # REVIEW: M8 reports for review
```

### Review: Parent-child alignment (M9)

```yaml
key: OrderProcess
description: Process customer orders
outcome: Order is fulfilled
states:
  - key: CancelOrder
    description: Cancel the order            # REVIEW: M9 flags — contradicts parent goal, verify ancestor alignment
    outcome: Order is cancelled
```
