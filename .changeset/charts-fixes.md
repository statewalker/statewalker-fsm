---
"@statewalker/fsm-charts": patch
---

Escape state labels, transition labels, ids and panel summaries written into the generated SVG/HTML (fixes markup injection from configs). Write valid `stroke-width` and `viewBox` attributes, and keep edge points with negative coordinates inside the chart canvas. Clicks inside a state's description panel (links, checkboxes) are no longer swallowed by the state click handler. `concatTransitionsToString` now quotes events containing `-`, `>`, edge whitespace or a leading quote, and `splitTransitionString` strips those quotes, so the two round-trip.
