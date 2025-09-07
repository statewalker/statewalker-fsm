export const STATE_ANY = "*";
export const STATE_INITIAL = "";
export const STATE_FINAL = "";
export const EVENT_ANY = "*";
export const EVENT_EMPTY = "";

export type FsmStateKey = string;
export type FsmEventKey = string;
export type FsmStateConfig = {
  key: FsmStateKey;
  transitions?: [from: FsmStateKey, event: FsmEventKey, to: FsmStateKey][];
  states?: FsmStateConfig[];
} & Record<string, unknown>;
