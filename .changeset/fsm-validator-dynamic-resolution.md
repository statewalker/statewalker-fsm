---
"@statewalker/fsm-validator": patch
---

Resolve state keys dynamically, through the live parent chain, as the runtime does (#25). A definition shared from an ancestor and entered inside another scope now resolves its keys through that scope: S1, S2, S3, S4, S6 and M1–M3 check every instantiation path, so valid configurations that only resolve through the caller are no longer rejected, and a shadowing definition the runtime actually enters is no longer reported unreachable. The README's "lexical, as in the engine" is corrected.
