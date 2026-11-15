/**
 * Escapes the characters that are significant in HTML/SVG markup (`& < > " '`),
 * so that the value can be written as text content or as a quoted attribute value.
 */
export function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
