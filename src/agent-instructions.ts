/**
 * Structured HFSM agent instructions exported as string constants.
 * Each section can be used independently as part of AI system prompts.
 */

export const dataModel = `\
type FsmStateConfig = {
  key: string;                           // PascalCase identifier (mandatory)
  description?: string;                  // purpose & behavior of this state
  outcome?: string;                      // expected result upon completion
  events?: Record<string, string>;       // event name → description of when/how it occurs
  transitions?: [string, string, string][]; // [from, event, to] tuples
  states?: FsmStateConfig[];             // nested sub-states (recursive)
  actors?: string[];                     // participating entities
  object?: string;                       // primary entity acted upon
};`;

export const outputFormat = `\
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
        events: ...`;

export const transitionPatterns = `\
| Pattern | Name | Meaning |
|---------|------|---------|
| ["", "*", "X"] | Initial | Entry point: activate sub-state X |
| ["A", "evt", "B"] | Standard | A emits evt: go to sibling B |
| ["*", "evt", "X"] | Wildcard source | From any state on evt: go to X |
| ["A", "*", "X"] | Wildcard event | From A on any event: go to X |
| ["A", "evt", ""] | Exit | A emits evt: exit parent scope |
| ["*", "evt", ""] | Global exit | Any state emits evt: exit parent |`;

export const namingRules = `\
- State keys: PascalCase matching /^[A-Z][a-zA-Z0-9]*$/ [L2]
- Event names in transitions: camelCase matching /^[a-z][a-zA-Z0-9]*$/ [L3, L6]
- Event keys in events records: camelCase [L7]
- State references in transitions: "", "*", or PascalCase key [L5]`;

export const structureRules = `\
1. Every state MUST have a non-empty key [L1]
2. No duplicate keys among sibling states [L8]
3. Every transition MUST be a 3-element array [from, event, to] [L4]
4. Sibling transitions at parent level — all transitions between siblings go in the parent's transitions, never inside a child [S3]
5. Initial transition required — every composite state (has states) must have ["", "*", X] [S1]
6. References are siblings only — transitions reference only states defined in the same parent's states[] [S2]
7. Reachability — every state must be reachable from the initial transition [S4]
8. No dead-ends — every non-final state needs at least one outgoing transition [S5]
9. Exit propagation — when a sub-state exits with [X, evt, ""], the parent must have a transition [CompositeParent, evt, Y] consuming that event [S6]
10. Wildcard determinism — wildcard transitions must not create ambiguity; two wildcards covering the same (state, event) pair are invalid [S7]
11. Leaf states must declare events — states without states[] SHOULD have an events field [S9]`;

export const eventConsistencyRules = `\
- Every event in events MUST have a matching transition [StateKey, event, _] in the parent, or be covered by a wildcard [M1]
- Every non-wildcard transition event MUST be declared in the source state's events [M2]
- If a child state emits an event handled by an ancestor, that event MUST be listed in the child's events [M3]`;

export const semanticConsistencyRules = `\
- Convergent transitions — when multiple transitions from the same source go to the same target via different events, verify the outcomes are semantically compatible [M4]
- Event-state consistency — event descriptions (when/how) must not contradict the declaring state's goals and outcomes [M8]
- Parent-child goal alignment — child state goals should not contradict parent goals; if they do, they should align with an ancestor's goals [M9]`;

export const transformationMethodology = `\
Step 1: Decompose into steps
Break the text into individual steps. For each step extract:
- Action — the main activity ("validate", "review", "process")
- Actor — who performs it (if stated)
- Object — what is acted upon (if stated)
- Conditions — prerequisites for the step
- Outcome — the result when the step completes
- Events — outcome-driven signals that trigger the next step
Use sequential indicators in the text ("first", "then", "after", "finally") to determine ordering.

Step 2: Build hierarchy
Group related steps into logical phases. Each phase becomes a composite state with sub-states.
- Aim for 3-7 sub-states per level
- If a sequence has more than 7 steps at one level, decompose into composite phases
- Each composite state needs its own transitions and states

Step 3: Identify branches and decision points
Look for conditional language ("if", "depending on", "either...or", "when X fails").
- Each branch outcome becomes a separate event
- Ensure outcomes are mutually exclusive and exhaustive — all possible paths are covered
- Each branch target must be a sibling state at the same level

Step 4: Identify cycles and ensure exits
Look for repetition language ("retry", "try again", "repeat until", "review again", "reprocess").
- Model cycles as transitions that loop back to earlier sibling states
- Every cycle must have exit events to prevent infinite loops:
  - A success exit — the cycle's goal is achieved (e.g., approved, validated)
  - A failure exit — a limit or error condition breaks the cycle (e.g., maxRetriesExceeded, timeout)

Step 5: Map outcomes to events and transitions
For each state:
1. Determine all possible outcomes
2. Name each outcome as a camelCase event
3. Write an event description: when and how this event occurs
4. Create a transition [StateKey, event, TargetSibling] in the parent's transitions
5. If the outcome exits the current scope, use [StateKey, event, ""] and ensure the parent handles it

Step 6: Fill gaps and refine
- If the text is ambiguous, make reasonable assumptions and note them in state descriptions
- Verify every state is reachable and every non-final state has an outgoing transition
- Verify every event in events has a matching transition in the parent [M1]
- Verify every transition event is declared in the source state's events [M2]
- Verify child exit events are declared in the child's events [M3]
- Verify leaf states (no sub-states) declare events [S9]
- Verify no duplicate keys among sibling states [L8]

Step 7: Semantic review
- Verify event descriptions do not contradict the declaring state's goals and outcomes [M8]
- Verify child state goals align with parent goals (or with ancestor goals if contradicting parent) [M9]
- Review convergent transitions — same source, different events, same target — for semantic compatibility [M4]`;

export const namingConventions = `\
- State keys: PascalCase, action-oriented (ProcessingOrder, ValidatingInput)
- Event names: camelCase (orderValid, paymentFailed, timeout)
- Process keys: PascalCase, business-workflow names (OrderFulfillment, UserRegistration)`;

export const examples = {
  lightBulb: `\
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
      toggle: When user presses the light switch`,

  ticketFlow: `\
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
      done: When closing procedures are complete`,
};

export const commonMistakes = `\
- Placing sibling transitions inside child states instead of the parent [S3]
- Missing initial transition ["", "*", X] on composite states [S1]
- Cycles without exit events (infinite loops) [M5]
- Events declared in events with no matching transition in parent [M1]
- Transition events not declared in source state's events [M2]
- Cross-level references (transitions pointing to non-sibling states) [S2]
- Duplicate keys among sibling states [L8]
- Convergent transitions with incompatible outcomes (e.g., ok and error both leading to the same state) [M4]
- Leaf states without events declarations [S9]
- Event descriptions that contradict the state's goals [M8]
- Child state goals that contradict parent goals without ancestor alignment [M9]
- Ambiguous wildcard transitions covering the same (state, event) pair [S7]`;

/**
 * Pre-composed prompt sections for common AI use cases.
 */
export const prompts = {
  /** System prompt for generating HFSM configs from text descriptions */
  generation: [
    "# HFSM Data Model",
    dataModel,
    "",
    "# Output Format (YAML)",
    outputFormat,
    "",
    "# Transition Patterns",
    transitionPatterns,
    "",
    "# Rules",
    "## Naming",
    namingRules,
    "## Structure",
    structureRules,
    "## Event Consistency",
    eventConsistencyRules,
    "",
    "# Transformation Methodology",
    transformationMethodology,
    "",
    "# Naming Conventions",
    namingConventions,
    "",
    "# Examples",
    "## Minimal: Light Bulb",
    examples.lightBulb,
    "## Nested with exit propagation: Ticket Flow",
    examples.ticketFlow,
    "",
    "# Common Mistakes to Avoid",
    commonMistakes,
  ].join("\n"),

  /** System prompt for structural + semantic validation */
  validation: [
    "# HFSM Data Model",
    dataModel,
    "",
    "# Transition Patterns",
    transitionPatterns,
    "",
    "# Rules",
    "## Naming",
    namingRules,
    "## Structure",
    structureRules,
    "## Event Consistency",
    eventConsistencyRules,
    "## Semantic Consistency",
    semanticConsistencyRules,
    "",
    "# Common Mistakes to Avoid",
    commonMistakes,
  ].join("\n"),

  /** System prompt for refining HFSM configs based on validation issues */
  refinement: [
    "# HFSM Data Model",
    dataModel,
    "",
    "# Output Format (YAML)",
    outputFormat,
    "",
    "# Transition Patterns",
    transitionPatterns,
    "",
    "# Rules",
    "## Naming",
    namingRules,
    "## Structure",
    structureRules,
    "## Event Consistency",
    eventConsistencyRules,
    "## Semantic Consistency",
    semanticConsistencyRules,
    "",
    "# Naming Conventions",
    namingConventions,
    "",
    "# Common Mistakes to Avoid",
    commonMistakes,
  ].join("\n"),
};
