import { type FsmState } from "../../src/index.ts";

export function getStateValue<T>(
  state: FsmState | undefined,
  key: string
): T | undefined {
  return state ? ((state as any).data?.[key] as T) : undefined;
}

export function findStateValue<T>(
  state: FsmState | undefined,
  key: string
): T | undefined {
  let value: T | undefined;
  for (
    let s: FsmState | undefined = state;
    value === undefined && !!s;
    s = s.parent
  ) {
    value = (s as any).data?.[key] as T;
  }
  return value;
}

export function setStateValue<T>(state: FsmState, key: string, value: T) {
  ((state as any).data = (state as any).data || {})[key] = value;
}

export function newStateValue<T>(
  key: string
): (state: FsmState) => [() => T | undefined, (value: T) => void] {
  return (state: FsmState) => {
    return [
      (find: boolean = true): T | undefined => {
        return find
          ? findStateValue<T>(state, key)
          : getStateValue<T>(state, key);
      },
      (value: T) => setStateValue(state, key, value),
    ];
  };
}
