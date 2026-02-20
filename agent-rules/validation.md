# HFSM Validation Checklist

Post-generation checklist for verifying HFSM definitions. Each item references a rule ID — see `rules.json` or `rules.md` for full constraint descriptions.

## Structural Checks

- [ ] Every state has a non-empty `key` [L1]
- [ ] State keys are PascalCase [L2]
- [ ] No duplicate keys among sibling states [L8]
- [ ] Every transition is a 3-element array `[from, event, to]` [L4]
- [ ] Every composite state has initial transition `["", "*", X]` [S1]
- [ ] All transitions reference only sibling states [S2]
- [ ] Sibling transitions declared at parent level, not inside children [S3]
- [ ] All sub-states reachable from initial transition [S4]
- [ ] Non-final states have at least one outgoing transition [S5]
- [ ] Wildcard transitions do not create ambiguity [S7]

## Naming Checks

- [ ] State keys match `/^[A-Z][a-zA-Z0-9]*$/` [L2]
- [ ] Event names in transitions match `/^[a-z][a-zA-Z0-9]*$/` [L3]
- [ ] Event keys in `events` records are camelCase [L7]
- [ ] State references in transitions are `""`, `"*"`, or PascalCase keys [L5]
- [ ] Event references in transitions are `"*"` or camelCase names [L6]

## Event Consistency Checks

- [ ] Every event in `events` has a matching transition in parent [M1]
- [ ] Every transition event exists in the source state's `events` [M2]
- [ ] Exit events `[X, evt, ""]` from sub-states are handled at parent level [S6]
- [ ] Child exit events are declared in the child's `events` [M3]
- [ ] Leaf states (no `states[]`) declare `events` [S9]

## Cycle and Branch Checks

- [ ] Every cycle has at least one exit transition [M5]
- [ ] Cycles include both success and failure exits [M5]
- [ ] Decision points have exhaustive outgoing events [M6]

## Complexity Checks

- [ ] 3-7 sub-states per hierarchical level [M7]
- [ ] Long sequential processes decomposed into composite phases [M7]

## Semantic Review (requires human judgment)

- [ ] Convergent transitions (same source, different events, same target) are intentional [M4]
- [ ] Event descriptions do not contradict the declaring state's goals and outcomes [M8]
- [ ] Child state goals align with parent goals (or with ancestor goals if contradicting parent) [M9]
