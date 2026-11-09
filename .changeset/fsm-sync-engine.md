---
"@statewalker/fsm": minor
---

Add a synchronous engine (`FsmProcessSync`, `FsmStateSync`, `FsmBaseClassSync`) and runner
(`startProcessSync`) built on the same traversal as the async engine; `ProcessHandle` gains
`dispatch`, `FsmProcess` gains `whenIdle()`.

Fixes:
- handlers added while a handler list runs no longer disturb it (an `onExit` adding an
  `onExit` looped forever);
- events sent to a finished machine are no longer queued;
- `shutdown()` requested from a handler or during a dispatch no longer recurses, deadlocks,
  exits states twice or revives the machine: it is recorded and applied by the running
  dispatch once the current handler returns (every entered state exits exactly once);
- the async runner applies generator events once the machine has settled, like the sync
  runner (a generator on a composite state no longer loses its first event);
- the runner's `restore` unwinds the live stack first.

Behaviour/type changes to check when upgrading:
- `FsmStateDumpHandler`'s second parameter is now typed as the state's `data` bag (what is
  passed at runtime) instead of `FsmStateDump`; code written against the old type no longer
  compiles.
- `shutdown()` on a machine that never started finishes it (a later `dispatch` is a no-op).
- `shutdown()` called while the machine is busy resolves immediately; use `whenIdle()` to
  wait for the unwinding. A ProcessHandle's `shutdown()` / `restore()` wait for an in-flight
  dispatch and resolve once done — call them from outside the machine (`KEY_TERMINATE` is the
  non-waiting variant for handlers).
- `restore()` throws when called while a dispatch or shutdown is running.
- A ProcessHandle's `restore` runs the `onExit` handlers of the states it replaces.
