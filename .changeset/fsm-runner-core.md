---
"@statewalker/fsm": patch
---

`startProcess` and `startProcessSync` share one runner core (#23): the context binding, guard, handler installation, terminate and restore are written once on the engine controller; each runner supplies only how to step a generator. A sync `load` that returns a promise is now reported as an "async load" misuse through `onStateError` instead of a "not iterable" `TypeError`. Public API unchanged.
