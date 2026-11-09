---
"@statewalker/fsm-viewer": minor
---

`renderStateCharts`, `renderStateDescription` and the state renderer accept either
`FsmProcess` or `FsmProcessSync` (the viewer's handlers are now synchronous, so the sync
engine no longer reports them as errors). `renderStateDescription` takes an optional
`invalidation` promise to stop following the process.
