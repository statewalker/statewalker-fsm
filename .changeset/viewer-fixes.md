---
"@statewalker/fsm-viewer": minor
"@statewalker/fsm-charts": patch
---

fsm-viewer: keep `@statewalker/fsm` and `@statewalker/fsm-charts` external, so the
types accept an `FsmProcess` from `@statewalker/fsm` and the bundle no longer carries
a copy of them; highlight exactly the engine's enabled transitions (wildcard sources
included) and dispatch an edge click only for one of them; the `renderer` option takes
key stacks (the renderer of `prepareStateDescriptions`) and runs once per state; the
returned element has `dispose()`, also called on `invalidation`, which releases the
listeners and the process subscription. fsm-charts: `StateChartIndex.findTransition`.
