import type { Transition } from "./Transition.js";

// export type FsmStateKey = string;
// export type FsmEventKey = string;
// export type FsmTransition = [FsmStateKey, FsmEventKey, FsmStateKey];
// export type FsmState = {
//   key: string;
//   transitions: FsmTransition[];
//   states?: FsmState[];
// } & Record<string, any>;

export type FsmStateConfig = {
  key: string;
  transitions?: Transition[];
  states?: FsmStateConfig[];
} & Record<string, any>;
