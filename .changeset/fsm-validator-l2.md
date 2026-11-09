---
"@statewalker/fsm-validator": patch
---

L2 now warns about every state key that is not PascalCase. Keys that also fail the
general key pattern (e.g. `"my-state"`, `"123invalid"`) used to be skipped, on the
assumption that L1/L4 reported them — but L1 only checks that a key exists and L4 only
checks transition references, so such a key on a state that is never referenced got no
diagnostic at all.
