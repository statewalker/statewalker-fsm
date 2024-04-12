import { bindMethods } from "./bindMethods.ts";

export class FsmBaseClass {
  protected handlers: Record<string, Function[]> = {};
  protected data: Record<string, unknown> = {};
  constructor() {
    bindMethods(
      this,
      "setData",
      "getData",
    );
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
    return this;
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
