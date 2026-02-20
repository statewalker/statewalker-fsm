# HFSM Validation Rules — Formalized Reference

> Date: 2026-02-20
> Source: `statewalker-site-fsm/src/documentation/concepts/`
> Derived from: `fsm-state-validation.md`, `fsm-state-schema.json`, `fsm-process-prompt.source.md`

This document formalizes the validation rules for Hierarchical Finite State Machine (HFSM) definitions used in StateWalker, distilled from documentation scattered across three source files into a unified, implementable specification.

---

## Data Model

```typescript
type StateKey   = string;   // PascalCase: /^[A-Z][a-zA-Z0-9]*$/
type EventKey   = string;   // camelCase:  /^[a-z][a-zA-Z0-9]*$/

type StateRef = "" | "*" | StateKey;
type EventRef = "*" | EventKey;

type Transition = [source: StateRef, event: EventRef, target: "" | StateKey];

interface FSMState {
  key: StateKey;                 // mandatory
  name?: string;                 // human-readable display name
  description?: string;          // purpose & behavior
  outcome?: string;              // expected result upon completion
  events?: EventKey[];           // events this state can emit
  actors?: string[];             // participating entities
  object?: string;               // primary entity acted upon
  transitions?: Transition[];    // rules between direct sub-states
  states?: FSMState[];           // nested sub-states (recursive)
}
```

---

## Tier 1 — Lexical Rules (naming & types)

| #  | Rule                          | Constraint |
|----|-------------------------------|------------|
| L1 | `key` is mandatory            | Every state object MUST have a non-empty `key` field |
| L2 | State keys are PascalCase     | `key` matches `/^[A-Z][a-zA-Z0-9]*$/` |
| L3 | Event names are camelCase     | Event strings match `/^[a-z][a-zA-Z0-9]*$/` |
| L4 | Transition is a 3-tuple       | Each element of `transitions[]` is `[sourceRef, eventRef, targetRef]` with exactly 3 elements |
| L5 | State reference values        | A source/target in a transition is one of: `""` (initial/terminal), `"*"` (wildcard), or a PascalCase state key |
| L6 | Event reference values        | An event in a transition is either `"*"` (wildcard) or a camelCase event name |
| L7 | `events` items are camelCase  | Every string in `events[]` matches `/^[a-z][a-zA-Z0-9]*$/` |
| L8 | No duplicate keys among siblings | Within a single `states[]` array, all `key` values are unique |

---

## Tier 2 — Structural Rules (graph topology)

| #  | Rule                                          | Constraint |
|----|-----------------------------------------------|------------|
| S1 | Initial transition required for composite states | If a state declares `states[]`, its `transitions[]` MUST contain exactly one entry `["", "*", X]` where `X` is a key of one of its direct sub-states |
| S2 | Transitions reference only siblings            | Every non-special (`""`, `"*"`) state key in `transitions[]` MUST match the `key` of a direct sub-state in the same parent's `states[]` |
| S3 | Sibling transitions declared at parent level   | Transitions between sibling states are declared ONLY in the parent's `transitions[]`, never inside a child state |
| S4 | Reachability                                   | Every sub-state must be reachable from the initial transition via some chain of transitions in the parent's `transitions[]` |
| S5 | No dead-ends (unless final)                    | Every non-final sub-state must have at least one outgoing transition. A state is "final" only if it has an exit transition `[Key, event, ""]` or is intentionally terminal |
| S6 | Exit event propagation                         | If a sub-state has an exit transition `[X, event, ""]`, the parent MUST have a transition `[CompositeParent, event, Y]` that consumes that event |
| S7 | Determinism with wildcards                     | Wildcard transitions must not create ambiguity. Specific transitions take priority over wildcards, but two wildcards covering the same (state, event) pair are invalid |
| S8 | No cross-level jumps                           | A transition's source and target must both be direct children of the state that owns the `transitions[]`. To reach nested states, model it as exit events bubbling up through parents |
| S9 | `events` mandatory for leaf states             | States without `states[]` (leaf states) MUST declare an `events[]` field |

---

## Tier 3 — Semantic Rules (consistency & completeness)

| #  | Rule                                              | Constraint |
|----|---------------------------------------------------|------------|
| M1 | Forward event coverage (events -> transitions)    | Every event `e` in state `S.events[]` MUST have a corresponding transition `[S.key, e, _]` in the parent's `transitions[]`, or be covered by a wildcard `[S.key, "*", _]` or `["*", e, _]` at the parent or ancestor level |
| M2 | Reverse event coverage (transitions -> events)    | Every non-wildcard event `e` in transition `[S, e, T]` MUST appear in state `S`'s `events[]` (unless `S` is `""` or `"*"`) |
| M3 | Hierarchical event declaration                    | If a child state emits an event handled by an ancestor transition, that event MUST be explicitly listed in the child's `events[]` |
| M4 | Semantic compatibility of convergent transitions   | When multiple transitions target the same state, source outcomes must be semantically compatible. Invalid: `[Validate, ok, Handle]` + `[Validate, error, Handle]` (contradictory outcomes converging) |
| M5 | Cycle break requirement                           | Every cycle in the transition graph MUST have at least one exit event/transition. Cycles must provide: (a) a success/termination exit, (b) a failure/limit-exceeded exit |
| M6 | Decision point exhaustiveness                     | Branching states should have mutually exclusive and collectively exhaustive outgoing events (all possible outcomes represented) |
| M7 | Manageable complexity                             | Each hierarchical level should contain 3-7 sub-states. Longer linear sequences should be decomposed into composite phases |

---

## Transition Type Reference

| Pattern              | Name            | Meaning |
|----------------------|-----------------|---------|
| `["", "*", "X"]`     | Initial         | Entry point: activate first sub-state `X` |
| `["A", "evt", "B"]`  | Standard        | `A` emits `evt`: transition to sibling `B` |
| `["*", "evt", "X"]`  | Wildcard source | From any state on `evt`: go to `X` |
| `["A", "*", "X"]`    | Wildcard event  | From `A` on any event: go to `X` |
| `["A", "evt", ""]`   | Exit            | `A` emits `evt`: exit parent scope |
| `["*", "evt", ""]`   | Global exit     | Any state emits `evt`: exit parent scope |

---

## Validation Algorithm (pseudocode)

```
VALIDATE(P):
  1. ASSERT P.key matches /^[A-Z][a-zA-Z0-9]*$/                    [L2]
  2. ASSERT all keys in P.states[] are unique                        [L8]

  IF P.states[] exists:
    3. ASSERT P.transitions[] contains exactly one ["", "*", X]      [S1]
       WHERE X in {s.key for s in P.states[]}

    4. FOR EACH transition [src, evt, tgt] in P.transitions[]:
       a. ASSERT length == 3                                         [L4]
       b. ASSERT src in {"", "*"} | {s.key for s in P.states[]}     [S2, L5]
       c. ASSERT tgt in {""} | {s.key for s in P.states[]}          [S2, L5]
       d. ASSERT evt in {"*"} | /^[a-z][a-zA-Z0-9]*$/              [L6]

    5. FOR EACH state S in P.states[]:
       a. ASSERT S is reachable from initial transition              [S4]
       b. ASSERT S has >= 1 outgoing transition OR exits to ""       [S5]

    6. FOR EACH leaf state S (S.states[] absent):
       a. ASSERT S.events[] is defined and non-empty                 [S9]
       b. FOR EACH e in S.events[]:
          ASSERT exists transition [S.key, e, _] in P.transitions[]
            OR covered by wildcard [S.key, "*", _]
            OR covered by wildcard ["*", e, _]                       [M1]

    7. FOR EACH transition [S, e, _] where S != "" and S != "*":
       LET state = find(S in P.states[])
       IF state.events[] is defined:
         ASSERT e == "*" OR e in state.events[]                      [M2]

    8. FOR EACH child C in P.states[] where C.transitions[] exists:
       FOR EACH exit transition [X, e, ""] in C.transitions[]:
         ASSERT exists [C.key, e, _] in P.transitions[]              [S6]

    9. DETECT cycles in transition graph
       ASSERT each cycle has >= 1 exit event                         [M5]

   10. CHECK wildcard overlaps for ambiguity                         [S7]

   11. RECURSE: FOR EACH S in P.states[]: VALIDATE(S)
```

---

## Validation Checklists

### Structural Checklist
- [ ] Every composite state has `["", "*", <InitialSubState>]`
- [ ] All sibling transitions are in the immediate parent's `transitions[]`
- [ ] Every state referenced in transitions exists in the same parent's `states[]`
- [ ] Each non-final state has at least one outgoing transition
- [ ] All states are reachable from the initial transition
- [ ] Exit events from sub-states are captured at the parent level
- [ ] Wildcard use is intentional and non-ambiguous

### Event Consistency Checklist
- [ ] Every event in `events[]` has a matching transition in the parent
- [ ] Every transition event exists in the source state's `events[]`
- [ ] Child exit events are handled by parent transitions
- [ ] No dead events (declared but never used in transitions)
- [ ] No undeclared events (used in transitions but not in `events[]`)

### Complex Process Checklist
- [ ] Long processes decomposed into 3-7 states per level
- [ ] All cycles have termination + failure exits
- [ ] Decision points are mutually exclusive and exhaustive
- [ ] Sub-processes have clear entry/exit boundaries
- [ ] Convergent transitions have semantically compatible sources

### Field Completeness Checklist
- [ ] `key` present on every state (mandatory)
- [ ] `events[]` present on every leaf state (mandatory)
- [ ] `description` present (recommended)
- [ ] `outcome` present (recommended)
- [ ] `actors` and `object` defined where applicable (optional)

---

## Examples

### Valid: Light Bulb (minimal)

```yaml
key: LightBulb
transitions:
  - ["", "*", "Off"]
  - ["Off", "toggle", "On"]
  - ["On", "toggle", "Off"]
states:
  - key: Off
    description: Light is turned off
    events: [toggle]
  - key: On
    description: Light is turned on
    events: [toggle]
```

**Rules satisfied:** L1-L8, S1-S5, S9, M1-M2.

### Valid: Ticket Flow (exit propagation)

```yaml
key: TicketFlow
transitions:
  - ["", "*", "Handle"]
  - ["Handle", "resolved", "Closed"]      # catches exit from Handle sub-state
  - ["Closed", "done", ""]
states:
  - key: Handle
    description: Handle the support ticket
    transitions:
      - ["", "*", "Diagnose"]
      - ["Diagnose", "notResolved", "Escalate"]
      - ["Diagnose", "resolved", ""]        # exit to parent
      - ["Escalate", "resolved", ""]
    states:
      - key: Diagnose
        description: Identify the issue
        events: [resolved, notResolved]
      - key: Escalate
        description: Escalate to L2
        events: [resolved]
  - key: Closed
    description: Ticket is closed
    events: [done]
```

**Rules satisfied:** S1, S6 (Handle exit `resolved` caught by parent), S8, M1-M3.

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

### Invalid: Semantic incompatibility

```yaml
transitions:
  - ["ValidateAccount", "ok", "HandleRequest"]
  - ["ValidateAccount", "error", "HandleRequest"]  # VIOLATION: contradictory outcomes -> fails M4
```
