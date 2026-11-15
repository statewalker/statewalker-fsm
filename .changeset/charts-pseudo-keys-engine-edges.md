---
"@statewalker/fsm-charts": patch
"@statewalker/fsm-viewer": patch
---

The pseudo-state keys travel with the built chart, and the engine decides which transitions are highlighted (#22). `buildFlatCharts` / `buildCharts` record `initialStateKey` and `finalStateKey` on the chart; `StateChartIndex`, `buildStatechartsPanel` and `buildStatechartSvg` read them from there, so a custom key no longer has to be passed to each of them (their options remain as deprecated overrides). The new `StateChartIndex.getTransitionEdges(stack, transitions)` maps the engine's `[from, event, to]` tuples to drawn edges, and the viewer uses it instead of its own mapping.
