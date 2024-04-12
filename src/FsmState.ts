import { bindMethods } from "./bindMethods.ts";
import { FsmProcess } from "./FsmProcess.ts";
import { FsmStateDescriptor } from "./FsmStateDescriptor.ts";

export type FsmStateDump = Record<string, any> & {
  key: string;
  data: Record<string, unknown>;
};
export type FsmStateHandler = (
  state: FsmState,
  ...args: unknown[]
) => void | Promise<void>;

export type FsmStateDumpHandler = (
  state: FsmState,
  dump: FsmStateDump
) => void | Promise<void>;

export class FsmState {
  process: FsmProcess;
  key: string;
  parent?: FsmState;
  descriptor?: FsmStateDescriptor;

  private handlers: Record<string, Function[]> = {};
  private data: Record<string, unknown> = {};

  constructor(
    process: FsmProcess,
    parent: FsmState | undefined,
    key: string,
    descriptor?: FsmStateDescriptor
  ) {
    this.process = process;
    this.key = key;
    this.parent = parent;
    this.descriptor = descriptor;
    bindMethods(
      this,
      "onEnter",
      "onExit",
      "dump",
      "restore",
      "setData",
      "getData",
      "findData",
      "useData"
    );
  }

  onEnter(handler: FsmStateHandler) {
    return this._addHandler("onEnter", handler, true);
  }
  onExit(handler: FsmStateHandler) {
    return this._addHandler("onExit", handler, false);
  }
  dump(handler: FsmStateDumpHandler) {
    return this._addHandler("dump", handler, true);
  }
  restore(handler: FsmStateDumpHandler) {
    return this._addHandler("restore", handler, true);
  }
  setData<T>(key: string, value: T) {
    this.data[key] = value;
    return this;
  }
  getData<T>(key: string, recursive: boolean = true): T | undefined {
    return (
      (this.data[key] as T) ??
      (recursive ? this.parent?.getData<T>(key, recursive) : undefined)
    );
  }
  useData<T>(key: string) {
    return [
      (recursive: boolean = true) => this.getData<T>(key, recursive),
      (value: T) => this.setData(key, value),
    ];
  }

  findData<V, R>(
    key: string,
    accept: (value: V) => R | undefined
  ): R | undefined {
    const value = this.getData<V>(key, false);
    const result: R | undefined =
      value !== undefined ? accept(value) : undefined;
    return result === undefined
      ? this.parent?.findData<V, R>(key, accept)
      : result;
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
        await handler(this, ...args);
      } catch (error) {
        await this.process.handleError(this, error);
      }
    }
  }
}
