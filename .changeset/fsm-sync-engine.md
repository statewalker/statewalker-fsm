---
"@statewalker/fsm": minor
---

Add a synchronous engine (`FsmProcessSync`, `FsmStateSync`, `FsmBaseClassSync`) and runner
(`startProcessSync`) built on the same traversal as the async engine; `ProcessHandle` gains
`dispatch`. Fixes: handlers added while a handler list runs no longer disturb it (an `onExit`
adding an `onExit` looped forever); events sent to a finished machine are no longer queued;
`shutdown()` is bound, finishes a never-started machine, discards queued events and is safe
to call concurrently; the runner's `restore` unwinds the live stack first; the
`FsmStateDumpHandler` type now matches the `data` bag passed at runtime.
