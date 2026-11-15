import type { Transition } from "../types/index.js";

export function splitTransitionString(str: string): Transition[] {
  let list: string[] = [];
  let pos = 0;
  const matches = Array.from(str.matchAll(/-\s*("[^"]*?"|'[^']*?'|[^-]*?)\s*->/g));
  for (const match of matches) {
    list.push(str.substring(pos, match.index));
    list.push(unquote(match[1].trim()));
    pos = match.index + match[0].length;
  }
  list.push(str.substring(pos));
  list = list.map((str, i) => (i % 2 ? str : str.trim()));
  const transitions: Transition[] = [];
  for (let i = 0; i < list.length - 2; ) {
    const from = list[i++] || "";
    const event = list[i++] || "";
    const to = list[i] || "";
    transitions.push([from, event, to]);
  }
  return transitions;
}

function unquote(str: string): string {
  const quote = str[0];
  if (str.length >= 2 && (quote === '"' || quote === "'") && str[str.length - 1] === quote) {
    return str.slice(1, -1);
  }
  return str;
}
