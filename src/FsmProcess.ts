import { bindMethods } from "./bindMethods.ts";
import { FsmState, FsmStateHandler, FsmStateDump } from "./FsmState.ts";
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
  ...args: any[]
) => void | Promise<void>;

export type FsmProcessDump = Record<string, any> & {
  status: number;
  event?: string;
  stack: FsmStateDump[];
};

export type FsmProcessDumpHandler = (
  process: FsmProcess,
  dump: FsmProcessDump
) => void | Promise<void>;

export type FsmProcessConfig<T = void> = {
  root: FsmStateConfig;
  onStateCreate?: (state: FsmState) => void;
  onStateError?: (state: FsmState, error?: Error) => void | Promise<void>;
};

export class FsmProcess {
  state?: FsmState;
  event?: string;
  status: number = 0;
  config: FsmProcessConfig;
  rootDescriptor: FsmStateDescriptor;

  constructor(config: FsmProcessConfig) {
    this.rootDescriptor = FsmStateDescriptor.build(config.root);
    this.config = config;
    bindMethods(this, "dispatch", "dump", "restore");
  }

  async dispatch(event: string, mask: number = STATUS_LEAF) {
    this.event = event;
    while (true) {
      if (this.status & STATUS_EXIT) {
        await this.state?._runHandler("onExit", this);
      }
      if (!this._update()) return false;
      if (this.status & STATUS_ENTER) {
        await this.state?._runHandler("onEnter", this);
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
      await state._runHandler("dump", stateDump, ...args);
      return stateDump;
    };
    const dumpStates = async (
      state: FsmState | undefined,
      stack: FsmStateDump[] = []
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
      await this.state._runHandler("restore", stateDump, ...args);
    }
    return this;
  }

  async handleError(state: FsmState, error: Error | unknown) {
    if (this.config.onStateError) {
      await this.config.onStateError(state, error as Error);
    } else {
      console.error(`[${state.key}]`, error);
    }
    return this;
  }

  _newState(
    parent: FsmState | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined
  ) {
    const state = new FsmState(this, parent, key, descriptor);
    this.config.onStateCreate?.(state);
    return state;
  }

  _getSubstate(parent: FsmState | undefined, prevStateKey: string | undefined) {
    if (!parent) return;
    const toState =
      parent.descriptor?.getTargetStateKey(
        prevStateKey || STATE_INITIAL,
        this.event || EVENT_EMPTY
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
        : this._newState(undefined, this.config.root.key, this.rootDescriptor);
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
