type Handler<P extends unknown[] = unknown[], R = unknown> = (...args: P) => R;

export class FsmBaseClass {
  handlers: Record<string, Handler[]> = {};

  // ----------------------------------------------
  // internal methods
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

  async _handleError(error: Error | unknown) {
    console.error(error);
  }
}

export function bindMethods<T>(obj: T, ...methods: (string | symbol)[]) {
  const o = obj as Record<string | symbol, unknown>;
  for (const methodName of methods) {
    const method = o[methodName];
    if (typeof method !== "function") continue;
    o[methodName] = method.bind(o);
  }
  return obj;
}
