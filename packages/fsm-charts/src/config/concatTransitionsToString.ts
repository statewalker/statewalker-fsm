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
    str += ` -${escapeLabel(event)}-> ${escapeLabel(to)}`;
    prev = to;
  }
  if (str) list.push(str);
  return list;

  function escapeLabel(str: string): string {
    return str;
  }
}
