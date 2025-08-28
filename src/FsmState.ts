import { bindMethods, FsmBaseClass } from "./FsmBaseClass.ts";
import type { FsmProcess } from "./FsmProcess.ts";
import type { FsmStateDescriptor } from "./FsmStateDescriptor.ts";

export type FsmStateDump = Record<string, unknown> & {
  key: string;
  data: Record<string, unknown>;
};
export type FsmStateHandler = (
  state: FsmState,
  ...args: unknown[]
) => void | Promise<void>;

export type FsmStateDumpHandler = (
  state: FsmState,
  dump: FsmStateDump,
) => void | Promise<void>;

export type FsmStateErrorHandler = (
  state: FsmState,
  error: unknown,
) => void | Promise<void>;

export class FsmState extends FsmBaseClass {
  process: FsmProcess;
  key: string;
  parent?: FsmState;
  descriptor?: FsmStateDescriptor;

  constructor(
    process: FsmProcess,
    parent: FsmState | undefined,
    key: string,
    descriptor?: FsmStateDescriptor,
  ) {
    super();
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
      "useData",
      "onStateError",
    );
  }

  onEnter(handler: FsmStateHandler) {
    return this._addHandler("onEnter", handler, true);
  }
  onExit(handler: FsmStateHandler) {
    return this._addHandler("onExit", handler, false);
  }
  onStateError(handler: FsmStateErrorHandler) {
    return this._addHandler("onStateError", handler);
  }
  dump(handler: FsmStateDumpHandler) {
    return this._addHandler("dump", handler, true);
  }
  restore(handler: FsmStateDumpHandler) {
    return this._addHandler("restore", handler, true);
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

  async _handleError(error: Error | unknown) {
    await this._runHandler("onStateError", this, error);
    await this.process._handleStateError(this, error);
  }
}
