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
    bindMethods(this, "init", "done", "dump", "restore");
  }

  init(handler: FsmStateHandler) {
    return this._addHandler("init", handler, true);
  }
  done(handler: FsmStateHandler) {
    return this._addHandler("done", handler, false);
  }
  dump(handler: FsmStateDumpHandler) {
    return this._addHandler("dump", handler, true);
  }
  restore(handler: FsmStateDumpHandler) {
    return this._addHandler("restore", handler, true);
  }
  _addHandler(type: string, handler: Function, direct: boolean = true) {
    const list = (this.handlers[type] = this.handlers[type] || []);
    direct ? list.push(handler) : list.unshift(handler);
    return this;
  }
  async _runHandler(type: string, ...args: unknown[]) {
    const list = this.handlers[type] || [];
    for (const handler of list) {
      await handler(this, ...args);
    }
  }
}
