import type { Transition } from "../types/index.js";

export function concatTransitionsToString(transitions: Transition[]) {
  const list: string[] = [];
  let str: string = "";
  let prev: undefined | string;
  for (const [from, event, to] of transitions) {
    if (prev !== from) {
      if (str) list.push(str);
      str = from;
    }
    str += ` -${escape(event)}-> ${escape(to)}`;
    prev = to;
  }
  if (str) list.push(str);
  return list;

  function escape(str: string): string {
    return str;
  }
}
