import type { Padding } from "../types/Padding.js";

/**
 * Expands a padding value to a 4-element array: [top, right, bottom, left].
 * @param padding padding value to expand
 * @returns a 4-element array representing the padding
 */
export function getPadding(padding: Padding): [number, number, number, number] {
  if (typeof padding === "number") return [padding, padding, padding, padding];
  if (padding.length === 2)
    return [padding[0], padding[1], padding[0], padding[1]];
  return padding;
}
