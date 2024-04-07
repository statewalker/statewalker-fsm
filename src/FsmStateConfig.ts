export const STATE_ANY = "*";
export const STATE_INITIAL = "";
export const STATE_FINAL = "";
export const EVENT_ANY = "*";
export const EVENT_EMPTY = "";

export type FsmStateConfig = {
  key: string;

  transitions: [string, string, string][];

  states?: FsmStateConfig[];
};
