import { toKebabCase } from "./toKebabCase.js";

export interface CssTree extends Record<string, string | number | CssTree> {}

export function serializeCss(obj: CssTree) {
  return visitStyle(obj).join("\n");

  function visitStyle(
    obj: CssTree,
    lines: string[] = [],
    prefixes: string[] = [""],
  ) {
    for (const [key, style] of Object.entries(obj)) {
      const selectors = [];
      for (const sel of key.split(",").map((_) => _.trim())) {
        for (const prefix of prefixes) {
          const selector = sel.replace(/^(.)/, (_, ch) =>
            ch === "&" ? prefix : prefix.length > 0 ? `${prefix} ${ch}` : ch,
          );
          selectors.push(selector);
        }
      }
      const selectorRules = [];
      const extensions: string[] = [];
      for (let [key, value] of Object.entries(style)) {
        if (typeof value === "object") {
          visitStyle({ [key]: value }, extensions, selectors);
        } else {
          key = toKebabCase(key);
          selectorRules.push(`  ${key}: ${value};`);
        }
      }
      if (selectorRules.length) {
        lines.push(`${selectors.join(",\n")} {`);
        lines.push(...selectorRules);
        lines.push(`}`);
      }
      lines.push(...extensions);
    }
    return lines;
  }
}
