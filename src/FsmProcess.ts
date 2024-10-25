import { FsmBaseClass, bindMethods } from "./FsmBaseClass.ts";
import { FsmState, FsmStateDump, FsmStateHandler } from "./FsmState.ts";
import {
  EVENT_EMPTY,
  FsmStateConfig,
  STATE_FINAL,
  STATE_INITIAL,
} from "./FsmStateConfig.ts";
import { FsmStateDescriptor } from "./FsmStateDescriptor.ts";

export const STATUS_NONE = 0;
export const STATUS_FIRST = 1;
export const STATUS_NEXT = 2;
export const STATUS_LEAF = 4;
export const STATUS_LAST = 8;
export const STATUS_FINISHED = 16;

//
export const STATUS_ENTER = STATUS_FIRST | STATUS_NEXT;
export const STATUS_EXIT = STATUS_LEAF | STATUS_LAST;

export type FsmProcessHandler = (
  process: FsmProcess,
  ...args: unknown[]
) => void | Promise<void>;

export type FsmProcessDump = Record<string, unknown> & {
  status: number;
  event?: string;
  stack: FsmStateDump[];
};

export type FsmProcessDumpHandler = (
  process: FsmProcess,
  dump: FsmProcessDump,
) => void | Promise<void>;

export class FsmProcess extends FsmBaseClass {
  state?: FsmState;
  event?: string;
  status: number = 0;
  config: FsmStateConfig;
  rootDescriptor: FsmStateDescriptor;

  constructor(config: FsmStateConfig) {
    super();
    this.rootDescriptor = FsmStateDescriptor.build(config);
    this.config = config;
    bindMethods(this, "dispatch", "dump", "restore");
  }

  async shutdown(event?: string) {
    while (this.state) {
      this.event = event;
      this.status = STATUS_FINISHED;
      await this.state?._runHandler("onExit", this.state);
      this.state = this.state.parent;
    }
  }

  async dispatch(event: string, mask: number = STATUS_LEAF) {
    this.event = event;
    while (true) {
      if (this.status & STATUS_EXIT) {
        await this.state?._runHandler("onExit", this.state);
      }
      if (!this._update()) return false;
      if (this.status & STATUS_ENTER) {
        await this.state?._runHandler("onEnter", this.state);
      }
      if (this.status & mask) return true;
    }
  }

  async dump(...args: unknown[]): Promise<FsmProcessDump> {
    const dumpState = async (state: FsmState) => {
      const stateDump: FsmStateDump = {
        key: state.key,
        data: {},
      };
      await state._runHandler("dump", state, stateDump.data, ...args);
      return stateDump;
    };
    const dumpStates = async (
      state: FsmState | undefined,
      stack: FsmStateDump[] = [],
    ) => {
      if (!state) return stack;
      state.parent && (await dumpStates(state.parent, stack));
      stack.push(await dumpState(state));
      return stack;
    };
    const dump: FsmProcessDump = {
      status: this.status,
      event: this.event,
      stack: await dumpStates(this.state),
    };
    return dump;
  }

  async restore(dump: FsmProcessDump, ...args: unknown[]) {
    this.status = dump.status || 0;
    this.event = dump.event;
    this.state = undefined;
    for (let i = 0; i < dump.stack.length; i++) {
      const stateDump = dump.stack[i];
      this.state = this.state
        ? this._newSubstate(this.state, stateDump.key)
        : this._newState(undefined, stateDump.key, this.rootDescriptor);
      await this.state._runHandler(
        "restore",
        this.state,
        stateDump.data,
        ...args,
      );
    }
    return this;
  }

  onStateCreate(handler: FsmStateHandler) {
    return this._addHandler("onStateCreate", handler, true);
  }

  onStateError(
    handler: (state: FsmState, error: unknown) => void | Promise<void>,
  ) {
    return this._addHandler("onStateError", handler);
  }

  async _handleStateError(state: FsmState, error: Error | unknown) {
    await this._runHandler("onStateError", state, error);
    this._handleError(error);
  }

  _newState(
    parent: FsmState | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined,
  ) {
    const state = new FsmState(this, parent, key, descriptor);
    this._runHandler("onStateCreate", state);
    return state;
  }

  _getSubstate(parent: FsmState | undefined, prevStateKey: string | undefined) {
    if (!parent) return;
    const toState =
      parent.descriptor?.getTargetStateKey(
        prevStateKey || STATE_INITIAL,
        this.event || EVENT_EMPTY,
      ) || STATE_FINAL;
    if (!toState) return;
    return this._newSubstate(parent, toState);
  }

  _newSubstate(parent: FsmState | undefined, toState: string) {
    let descriptor: FsmStateDescriptor | undefined;
    for (
      let state: FsmState | undefined = parent;
      !descriptor && state;
      state = state.parent
    ) {
      descriptor = state.descriptor?.states[toState];
    }
    return this._newState(parent, toState, descriptor);
  }

  _update() {
    if (this.status & STATUS_FINISHED) return false;
    const nextState =
      this.status !== STATUS_NONE
        ? this.status & STATUS_ENTER
          ? this._getSubstate(this.state, STATE_INITIAL)
          : this._getSubstate(this.state?.parent, this.state?.key)
        : this._newState(undefined, this.config.key, this.rootDescriptor);
    if (nextState !== undefined) {
      this.state = nextState;
      this.status = this.status & STATUS_EXIT ? STATUS_NEXT : STATUS_FIRST;
    } else {
      if (this.status & STATUS_EXIT) {
        this.state = this.state?.parent;
        this.status = STATUS_LAST;
      } else {
        this.status = STATUS_LEAF;
      }
      if (!this.state) this.status = STATUS_FINISHED;
    }
    return !(this.status & STATUS_FINISHED);
  }
}
