# HFSM Process Definition — Instructions for AI Agents

Transform human-readable process descriptions into formal Hierarchical Finite State Machine (HFSM) definitions.

## Data Model

```typescript
type FsmStateConfig = {
  key: string;                           // PascalCase identifier (mandatory)
  description?: string;                  // purpose & behavior of this state
  outcome?: string;                      // expected result upon completion
  events?: Record<string, string>;       // event name → description of when/how it occurs
  transitions?: [string, string, string][]; // [from, event, to] tuples
  states?: FsmStateConfig[];             // nested sub-states (recursive)
  actors?: string[];                     // participating entities
  object?: string;                       // primary entity acted upon
};
```

## Output Format

```yaml
key: <ProcessKey>
description: <High-level process description>
outcome: <Expected result of the entire process>
transitions:
  - ["", "*", <InitialState>]
  - [<From>, <event>, <To>]
  - [<From>, <event>, ""]        # exit transition
states:
  - key: <StateKey>
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

## Transition Patterns

| Pattern | Name | Meaning |
|---------|------|---------|
| `["", "*", "X"]` | Initial | Entry point: activate sub-state X |
| `["A", "evt", "B"]` | Standard | A emits evt: go to sibling B |
| `["*", "evt", "X"]` | Wildcard source | From any state on evt: go to X |
| `["A", "*", "X"]` | Wildcard event | From A on any event: go to X |
| `["A", "evt", ""]` | Exit | A emits evt: exit parent scope |
| `["*", "evt", ""]` | Global exit | Any state emits evt: exit parent |

## Structural Rules

1. **Sibling transitions at parent level** — all transitions between siblings go in the parent's `transitions`, never inside a child
2. **Initial transition required** — every composite state (has `states`) must have `["", "*", X]`
3. **Exit propagation** — when a sub-state exits with `[X, evt, ""]`, the parent must have a transition `[CompositeParent, evt, Y]` consuming that event
4. **References are siblings only** — transitions reference only states defined in the same parent's `states[]`
5. **Reachability** — every state must be reachable from the initial transition
6. **No dead-ends** — every non-final state needs at least one outgoing transition

## How to Transform Text into HFSM

### Step 1: Decompose into steps

Break the text into individual steps. For each step extract:

- **Action** — the main activity ("validate", "review", "process")
- **Actor** — who performs it (if stated)
- **Object** — what is acted upon (if stated)
- **Conditions** — prerequisites for the step
- **Outcome** — the result when the step completes
- **Events** — outcome-driven signals that trigger the next step

Use sequential indicators in the text ("first", "then", "after", "finally") to determine ordering.

### Step 2: Build hierarchy

Group related steps into logical phases. Each phase becomes a composite state with sub-states.

- Aim for **3-7 sub-states** per level
- If a sequence has more than 7 steps at one level, decompose into composite phases
- Each composite state needs its own `transitions` and `states`

### Step 3: Identify branches and decision points

Look for conditional language ("if", "depending on", "either...or", "when X fails").

- Each branch outcome becomes a separate event
- Ensure outcomes are **mutually exclusive and exhaustive** — all possible paths are covered
- Each branch target must be a sibling state at the same level

### Step 4: Identify cycles and ensure exits

Look for repetition language ("retry", "try again", "repeat until", "review again", "reprocess").

- Model cycles as transitions that loop back to earlier sibling states
- Every cycle **must** have exit events to prevent infinite loops:
  - A **success exit** — the cycle's goal is achieved (e.g., `approved`, `validated`)
  - A **failure exit** — a limit or error condition breaks the cycle (e.g., `maxRetriesExceeded`, `timeout`)

### Step 5: Map outcomes to events and transitions

For each state:

1. Determine all possible outcomes
2. Name each outcome as a camelCase event
3. Write an event description: when and how this event occurs
4. Create a transition `[StateKey, event, TargetSibling]` in the parent's `transitions`
5. If the outcome exits the current scope, use `[StateKey, event, ""]` and ensure the parent handles it

### Step 6: Fill gaps and refine

- If the text is ambiguous, make reasonable assumptions and note them in state descriptions
- Verify every state is reachable and every non-final state has an outgoing transition
- Verify every event in `events` has a matching transition in the parent
- Verify every transition event is declared in the source state's `events`

## Naming Conventions

- **State keys**: PascalCase, action-oriented (`ProcessingOrder`, `ValidatingInput`)
- **Event names**: camelCase (`orderValid`, `paymentFailed`, `timeout`)
- **Process keys**: PascalCase, business-workflow names (`OrderFulfillment`, `UserRegistration`)

## Examples

### Minimal: Light Bulb

```yaml
key: LightBulb
description: A simple on/off light bulb
transitions:
  - ["", "*", "Off"]
  - ["Off", "toggle", "On"]
  - ["On", "toggle", "Off"]
states:
  - key: Off
    description: Light is off
    events:
      toggle: When user presses the light switch
  - key: On
    description: Light is on
    events:
      toggle: When user presses the light switch
```

### Nested with exit propagation: Ticket Flow

```yaml
key: TicketFlow
description: Support ticket lifecycle
outcome: Ticket is resolved and closed
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

## Common Mistakes

- Placing sibling transitions inside child states instead of the parent
- Missing initial transition `["", "*", X]` on composite states
- Cycles without exit events (infinite loops)
- Events declared in `events` with no matching transition in parent
- Cross-level references (transitions pointing to non-sibling states)
- Convergent transitions with incompatible outcomes (e.g., `ok` and `error` both leading to the same state)
