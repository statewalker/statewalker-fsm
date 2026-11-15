---
"@statewalker/fsm": patch
---

Each engine reuses one controller step record instead of allocating one per dispatch (#60); a step clears what it referenced once it runs, so nothing is retained between dispatches. The README records the measured cost of the single controller: on the sync CSV example about 0.52 µs per dispatch against 0.43 µs before the controller (+21%); the async engine is unchanged.
