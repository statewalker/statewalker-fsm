import { toKebabCase } from "./toKebabCase.js";

export function serializeAttrs(
  attrs: Record<string, string | number | undefined> = {},
  {
    prefix = "",
    transform = false,
  }: { prefix?: string; transform?: boolean } = {},
) {
  const result: string[] = [];
  for (const [key, value] of Object.entries(attrs || {}).sort(([a], [b]) =>
    a > b ? 1 : -1,
  )) {
    if (value === undefined || value === null || value === "") continue;
    result.push(
      `${prefix}${escapeValue(key)}${
        "=" +
        JSON.stringify(
          escapeValue(transform ? toKebabCase(String(value)) : value),
        )
      }`,
    );
  }
  return result.join(" ");

  function escapeValue(value: string | number | undefined): string {
    return String(value)
      .replaceAll(/</gim, "&lt;")
      .replaceAll(/>/gim, "&gt;")
      .replaceAll(/"/gim, "&quot;");
  }
}
