---
"@statewalker/fsm-validator": patch
---

Validator fixes:

- Malformed `transitions` entries, a non-array `transitions` or `states`, and non-object states are now reported (L3, L1) instead of throwing a `TypeError`.
- S1 requires exactly one `["", "*", X]` initial transition: it now reports a composite whose only initial transitions have specific events, and a second `"*"` initial transition.
- S6 checks a shared composite against every scope that instantiates it, not the scope that defines it.
- M3 implements its documented rule (an exit event a referencing scope handles must be listed in the state's `events`) and no longer duplicates S6.
- M2 accepts events declared on an ancestor of the source state.
- M7 text says "recommended 2-7", matching what the rule checks; M1's message no longer claims the process cannot leave a state.
- S4 no longer reports `State "undefined" is unreachable` for a child without a key.
- `formatReportCompact` escapes `|` and newlines in table cells.
