import { escapeHtml } from "./escapeHtml.js";
import { toKebabCase } from "./toKebabCase.js";

export function serializeAttrs(
  attrs: Record<string, string | number | undefined> = {},
  { prefix = "", transform = false }: { prefix?: string; transform?: boolean } = {},
) {
  const result: string[] = [];
  for (const [key, value] of Object.entries(attrs || {}).sort(([a], [b]) => (a > b ? 1 : -1))) {
    if (value === undefined || value === null || value === "") continue;
    result.push(
      `${prefix}${escapeHtml(key)}="${escapeHtml(transform ? toKebabCase(String(value)) : value)}"`,
    );
  }
  return result.join(" ");
}
