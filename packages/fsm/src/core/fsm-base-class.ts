type Handler<P extends unknown[] = unknown[], R = unknown> = (...args: P) => R;

/**
 * Named, ordered handler lists — the registry shared by the async engine
 * (`FsmBaseClass`) and the sync engine (`FsmBaseClassSync`).
 *
 * `handlers` maps a hook name to its ordered callback list; `_addHandler` /
 * `_removeHandler` manage it. Lists are treated as immutable values (every
 * add/remove installs a fresh array), so a handler that registers or removes
 * handlers while its own list is running never disturbs that iteration.
 */
export class FsmHandlers {
  handlers: Record<string, Handler[]> = {};

  /**
   * Register `handler` under `type`; returns a disposer that removes it.
   * `direct=false` prepends instead of appends — used so `onExit` handlers run in
   * reverse (inner-to-outer) unwinding order.
   */
  protected _addHandler<T>(type: string, handler: T, direct: boolean = true) {
    const list = this.handlers[type] ?? [];
    const h = handler as Handler;
    this.handlers[type] = direct ? [...list, h] : [h, ...list];
    return () => this._removeHandler(type, h);
  }

  protected _removeHandler<T>(type: string, handler: T) {
    const list = this.handlers[type];
    if (!list) return;
    const next = list.filter((h) => h !== handler);
    if (next.length > 0) {
      this.handlers[type] = next;
    } else {
      delete this.handlers[type];
    }
  }
}

/**
 * Shared handler-registry substrate under both `FsmProcess` and `FsmState`.
 *
 * Both the process and every state need the same primitive: keep named lists of
 * callbacks (`onEnter`, `onExit`, `dump`, …) and run them with consistent ordering
 * and error routing. Centralising it here keeps the two subclasses thin and their
 * hook methods one-liners. Handlers run **sequentially** (awaited in turn) over a
 * snapshot of the list taken when the run starts; a throwing handler is routed to
 * `_handleError` rather than aborting the batch. Subclasses expose typed sugar
 * (e.g. `state.onEnter(fn)` calls `_addHandler("onEnter", fn)`) and override
 * `_handleError` to forward errors.
 */
export class FsmBaseClass extends FsmHandlers {
  /** Run every handler of `type` in order, awaiting each; route throws to `_handleError`. */
  async _runHandler(type: string, ...args: unknown[]) {
    const list = this.handlers[type] || [];
    for (const handler of list) {
      try {
        await handler(...args);
      } catch (error) {
        await this._handleError(error);
      }
    }
  }

  /** Default error sink — logs. `FsmState`/`FsmProcess` override it to fire `onStateError`. */
  async _handleError(error: Error | unknown) {
    console.error(error);
  }
}

/**
 * Synchronous twin of {@link FsmBaseClass}, used by `FsmProcessSync` / `FsmStateSync`.
 *
 * Handlers are called in order without awaiting. A handler that returns a promise
 * (an `async` function) cannot be honoured synchronously: it is reported to
 * `_handleError` as a `TypeError`, and its eventual rejection is routed there too
 * instead of becoming an unhandled rejection.
 */
export class FsmBaseClassSync extends FsmHandlers {
  /** Run every handler of `type` in order; route throws to `_handleError`. */
  _runHandler(type: string, ...args: unknown[]): void {
    const list = this.handlers[type] || [];
    for (const handler of list) {
      try {
        const result = handler(...args);
        if (isThenable(result)) {
          result.then(undefined, (error: unknown) => this._handleError(error));
          throw new TypeError(
            `Asynchronous "${type}" handler used with a synchronous FSM; ` +
              "its result is not awaited. Use FsmProcess for async handlers.",
          );
        }
      } catch (error) {
        this._handleError(error);
      }
    }
  }

  /** Default error sink — logs. `FsmStateSync`/`FsmProcessSync` override it. */
  _handleError(error: Error | unknown): void {
    console.error(error);
  }
}

/** `true` for promise-like values (anything with a callable `then`). */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Bind the named methods of `obj` to `obj` in place, so they can be passed as bare
 * callbacks (e.g. `ctx[KEY_DISPATCH] = process.dispatch`) without losing `this`.
 */
export function bindMethods<T>(obj: T, ...methods: (string | symbol)[]) {
  const o = obj as Record<string | symbol, unknown>;
  for (const methodName of methods) {
    const method = o[methodName];
    if (typeof method !== "function") continue;
    o[methodName] = method.bind(o);
  }
  return obj;
}
