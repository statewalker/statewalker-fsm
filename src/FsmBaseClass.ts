type Handler<P extends unknown[] = unknown[], R = unknown> = (...args: P) => R; // Function;
// type Handler = Function;

export class FsmBaseClass {
  handlers: Record<string, Handler[]> = {};
  data: Record<string, unknown> = {};
  constructor() {
    bindMethods(this, "setData", "getData");
  }
  setData<T>(key: string, value: T) {
    this.data[key] = value;
    return this;
  }
  getData<T>(key: string): T | undefined {
    return this.data[key] as T;
  }

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

  async _runHandlerParallel(type: string, ...args: unknown[]) {
    const list = this.handlers[type] || [];
    await Promise.all(
      list.map(async (handler) => {
        try {
          await handler(...args);
        } catch (error) {
          this._handleError(error);
        }
      }),
    );
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
