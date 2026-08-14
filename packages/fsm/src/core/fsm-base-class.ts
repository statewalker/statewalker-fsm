type Handler<P extends unknown[] = unknown[], R = unknown> = (...args: P) => R;

/**
 * Shared handler-registry substrate under both `FsmProcess` and `FsmState`.
 *
 * Both the process and every state need the same primitive: keep named lists of
 * callbacks (`onEnter`, `onExit`, `dump`, …) and run them with consistent ordering
 * and error routing. Centralising it here keeps the two subclasses thin and their
 * hook methods one-liners. `handlers` maps a hook name to its ordered callback list;
 * the protected `_addHandler` / `_removeHandler` / `_runHandler` manage and invoke
 * them. Handlers run **sequentially** (awaited in turn); a throwing handler is routed
 * to `_handleError` rather than aborting the batch. Subclasses expose typed sugar
 * (e.g. `state.onEnter(fn)` calls `_addHandler("onEnter", fn)`) and override
 * `_handleError` to forward errors.
 */
export class FsmBaseClass {
  handlers: Record<string, Handler[]> = {};

  // ----------------------------------------------
  // internal methods

  /**
   * Register `handler` under `type`; returns a disposer that removes it.
   * `direct=false` prepends instead of appends — used so `onExit` handlers run in
   * reverse (inner-to-outer) unwinding order.
   */
  protected _addHandler<T>(type: string, handler: T, direct: boolean = true) {
    let list = this.handlers[type];
    if (!list) {
      list = this.handlers[type] = [];
    }
    const h = handler as Handler;
    direct ? list.push(h) : list.unshift(h);
    return () => this._removeHandler(type, h);
  }

  protected _removeHandler<T>(type: string, handler: T) {
    let list = this.handlers[type];
    if (!list) return;
    list = list.filter((h) => h !== handler);
    if (list.length > 0) {
      this.handlers[type] = list;
    } else {
      delete this.handlers[type];
    }
  }

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
