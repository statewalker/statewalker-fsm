---
"@statewalker/fsm": patch
---

`FsmProcess` and `FsmProcessSync` are now thin shells over one engine controller (#21): the dispatch loop, re-entrancy queue, pending shutdown, unwinding, dump and restore are written once as step generators, driven by awaiting each step (async) or calling it directly (sync). Behaviour and public API are unchanged; the controller is internal.
