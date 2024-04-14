import { bindMethods } from "./utils/bindMethods.ts";

export class FsmBaseClass {
  handlers: Record<string, Function[]> = {};
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
  _addHandler(type: string, handler: Function, direct: boolean = true) {
    const list = (this.handlers[type] = this.handlers[type] || []);
    direct ? list.push(handler) : list.unshift(handler);
    return () => this._removeHandler(type, handler);
  }

  _removeHandler(type: string, handler: Function) {
    let list = this.handlers[type];
    if (!list) return;
    list = list.filter((h) => h !== handler);
    if (list.length > 0) {
      this.handlers[type] = list;
    } else {
      delete this.handlers[type];
    }
  }
  _runHandlerSync(type: string, ...args: unknown[]) {
    const list = this.handlers[type] || [];
    return list.map((handler) => handler(...args));
  }
  async _runHandler(type: string, ...args: unknown[]) {
    const promises = this._runHandlerSync(type, ...args);
    for (const promise of promises) {
      try {
        await promise;
      } catch (error) {
        await this._handleError(error);
      }
    }
  }
  async _handleError(error: Error | unknown) {
    console.error(error);
  }
}
