# @statewalker/fsm-charts

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
