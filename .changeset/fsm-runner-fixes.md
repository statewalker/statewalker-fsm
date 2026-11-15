---
"@statewalker/fsm": patch
---

- The runners' dispatch guard is checked when an event is applied, not when it is queued: an event dispatched while the machine is busy no longer unwinds it when it lands in a state with no rule for it (new optional `eventFilter` on `FsmProcess` / `FsmProcessSync`).
- `getStateTransitions` follows `dispatch`: an inner exit-to-final rule no longer hides the outer rule the event bubbles to, and an inner wildcard-event rule hides the outer rules.
- `restore` throws on a dump whose root key differs from the machine's.
