# @statewalker/fsm-charts

## 0.2.9

### Patch Changes

- 6954d50: The pseudo-state keys travel with the built chart, and the engine decides which transitions are highlighted (#22). `buildFlatCharts` / `buildCharts` record `initialStateKey` and `finalStateKey` on the chart; `StateChartIndex`, `buildStatechartsPanel` and `buildStatechartSvg` read them from there, so a custom key no longer has to be passed to each of them (their options remain as deprecated overrides). The new `StateChartIndex.getTransitionEdges(stack, transitions)` maps the engine's `[from, event, to]` tuples to drawn edges, and the viewer uses it instead of its own mapping.

## 0.2.8

### Patch Changes

- ea31027: Escape state labels, transition labels, ids and panel summaries written into the generated SVG/HTML (fixes markup injection from configs). Write valid `stroke-width` and `viewBox` attributes, and keep edge points with negative coordinates inside the chart canvas. Clicks inside a state's description panel (links, checkboxes) are no longer swallowed by the state click handler. `concatTransitionsToString` now quotes events containing `-`, `>`, edge whitespace or a leading quote, and `splitTransitionString` strips those quotes, so the two round-trip.
- 84ff762: fsm-viewer: keep `@statewalker/fsm` and `@statewalker/fsm-charts` external, so the
  types accept an `FsmProcess` from `@statewalker/fsm` and the bundle no longer carries
  a copy of them; highlight exactly the engine's enabled transitions (wildcard sources
  included) and dispatch an edge click only for one of them; the `renderer` option takes
  key stacks (the renderer of `prepareStateDescriptions`) and runs once per state; the
  returned element has `dispose()`, also called on `invalidation`, which releases the
  listeners and the process subscription. fsm-charts: `StateChartIndex.findTransition`.

## 0.2.7

### Patch Changes

- Release of the changes since the last published version:
  
  - files changed: README.md, dist/buildStatechartsPanel-BX7e0GzA.js, dist/buildStatechartsPanel-BX7e0GzA.js.map, dist/buildStatechartsPanel-CxQlIwTh.js, dist/buildStatechartsPanel-CxQlIwTh.js.map, 5 more

## 0.2.6

### Patch Changes

- Release of the changes since the last published version:
  
  - files changed: README.md, dist/StateChart-BYBjTmC2.d.ts, dist/StateChart-cXyVRcs-.d.ts, dist/StateChart-cXyVRcs-.d.ts.map, dist/StateChartIndex-BK2315qj.d.ts, 68 more

## 0.2.5

### Patch Changes

Bug fixes found by an adversarial review (+ the earlier build repair):

- **`buildSections` crashed / dropped / mis-nested sections.** Section depth was derived
  from a `±1` delta on the sign of the header-level change, which went negative (crash:
  `Cannot read properties of undefined`), orphaned sections whose header was shallower
  than a predecessor (silent data loss), and mis-nested a top-level header following deep
  nesting. Depth is now derived from an explicit stack of the real header magnitudes.
- **`serializeAttrs` emitted the invalid `&qout;` entity** instead of `&quot;` for escaped
  double-quotes in attribute values.
- (0.2.4→0.2.5 also carries the build repair: self-contained tsconfig, `vitest/config`,
  pnpm scripts — the package builds JS + DTS again.)
