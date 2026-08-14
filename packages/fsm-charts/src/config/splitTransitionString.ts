import type { Transition } from "../types/index.js";

export function splitTransitionString(str: string): Transition[] {
  let list: string[] = [];
  let pos = 0;
  const matches = Array.from(
    str.matchAll(/-\s*("[^"]*?"|'[^']*?'|[^-]*?)\s*->/g),
  );
  for (const match of matches) {
    list.push(str.substring(pos, match.index));
    list.push(match[1]);
    pos = match.index + match[0].length;
  }
  list.push(str.substring(pos));
  list = list.map((str) => str.trim());
  const transitions: Transition[] = [];
  for (let i = 0; i < list.length - 2; ) {
    const from = list[i++] || "";
    const event = list[i++] || "";
    const to = list[i] || "";
    transitions.push([from, event, to]);
  }
  return transitions;
}
