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
    str += ` -${escapeLabel(event)}-> ${to}`;
    prev = to;
  }
  if (str) list.push(str);
  return list;

  // Quote events which splitTransitionString could not read back as they are:
  // with "-" or ">", with leading/trailing whitespace, or starting with a quote.
  function escapeLabel(str: string): string {
    if (!/[->]|^\s|\s$|^["']/.test(str)) return str;
    if (!str.includes('"')) return `"${str}"`;
    if (!str.includes("'")) return `'${str}'`;
    return str;
  }
}
