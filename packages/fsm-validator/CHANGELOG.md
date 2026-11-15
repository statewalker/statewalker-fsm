# @statewalker/fsm-validator

## 0.2.3

### Patch Changes

- 7a4bacb: Validator fixes:
  
  - Malformed `transitions` entries, a non-array `transitions` or `states`, and non-object states are now reported (L3, L1) instead of throwing a `TypeError`.
  - S1 requires exactly one `["", "*", X]` initial transition: it now reports a composite whose only initial transitions have specific events, and a second `"*"` initial transition.
  - S6 checks a shared composite against every scope that instantiates it, not the scope that defines it.
  - M3 implements its documented rule (an exit event a referencing scope handles must be listed in the state's `events`) and no longer duplicates S6.
  - M2 accepts events declared on an ancestor of the source state.
  - M7 text says "recommended 2-7", matching what the rule checks; M1's message no longer claims the process cannot leave a state.
  - S4 no longer reports `State "undefined" is unreachable` for a child without a key.
  - `formatReportCompact` escapes `|` and newlines in table cells.

## 0.2.2

### Patch Changes

- 45896e4: L2 now warns about every state key that is not PascalCase. Keys that also fail the
  general key pattern (e.g. `"my-state"`, `"123invalid"`) used to be skipped, on the
  assumption that L1/L4 reported them — but L1 only checks that a key exists and L4 only
  checks transition references, so such a key on a state that is never referenced got no
  diagnostic at all.

## 0.2.1

### Patch Changes

- Release of the changes since the last published version:
  
  - files changed: README.md, dist/index.d.ts, dist/index.d.ts.map, dist/index.js.map, src/agent-rules.ts, 7 more
