# HFSM Validation Checklist

Post-generation checklist for verifying HFSM definitions. Each item references a rule ID — see `rules.json` or `rules.md` for full constraint descriptions.

## Structural Checks

- [ ] Every state has a non-empty `key` [L1]
- [ ] State keys are PascalCase [L2]
- [ ] No duplicate keys among sibling states [L7]
- [ ] Every transition is a 3-element array `[from, event, to]` [L3]
- [ ] Every composite state has initial transition `["", "*", X]` [S1]
- [ ] Every state key in a transition resolves — in this state's `states[]` or an ancestor's [S2]
- [ ] Sibling transitions declared at parent level, not inside children [S3]
- [ ] All sub-states reachable from initial transition, or referenced by a descendant scope as a shared definition [S4]
- [ ] Non-final states have at least one outgoing transition [S5]
- [ ] Wildcard transitions do not create ambiguity [S7]
- [ ] Keys redefined at several depths shadow deliberately [S9]

## Naming Checks

- [ ] State keys match `/^[A-Z][a-zA-Z0-9]*$/` [L2]
- [ ] Event keys in `events` records are camelCase [L6]
- [ ] State references in transitions are `""`, `"*"`, or PascalCase keys [L4]
- [ ] Event references in transitions are `"*"` or camelCase names [L5]

## Event Consistency Checks

- [ ] Every event in `events` is handled by at least one scope referencing the state, and every referencing scope handles at least one [M1]
- [ ] Every transition event exists in the source state's `events` [M2]
- [ ] Exit events `[X, evt, ""]` from sub-states are handled at parent level [S6]
- [ ] Child exit events are declared in the child's `events` [M3]
- [ ] Leaf states (no `states[]`) declare `events` [S8]

## Cycle and Branch Checks

- [ ] Every cycle has at least one exit transition [M5]
- [ ] Decision points have exhaustive outgoing events [M6]

## Complexity Checks

- [ ] 3-7 sub-states per hierarchical level [M7]
- [ ] Long sequential processes decomposed into composite phases [M7]

## Semantic Review (requires human judgment)

- [ ] Convergent transitions (same source, different events, same target) are intentional [M4]
- [ ] Event descriptions do not contradict the declaring state's goals and outcomes [M8]
- [ ] Child state goals align with parent goals (or with ancestor goals if contradicting parent) [M9]
