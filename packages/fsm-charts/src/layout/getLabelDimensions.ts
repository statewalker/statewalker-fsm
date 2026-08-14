import type { Dimensions } from "../types/Dimensions.js";
import type { Padding } from "../types/Padding.js";
import { getPadding } from "../utils/getPadding.js";

export function getLabelDimensions(
  label: string,
  {
    padding = 0,
    fontSize = 14,
    getCharWidth = () => fontSize / 1.61, // Golden ratio and all that jazz :-)
    lineGap = fontSize * 0.2,
  }: {
    padding?: Padding;
    fontSize?: number;
    getCharWidth?: (char: string) => number;
    lineGap?: number;
  } = {},
) {
  const lines = [label]; // label.split("\n");
  let dimensions: Dimensions = { width: 0, height: 0 };
  let lineNumber = 0;
  for (const line of lines) {
    if (lineNumber++) dimensions.height += lineGap;
    dimensions = expandBox(
      dimensions,
      getLineDimensions({
        line,
        fontSize,
        getCharWidth,
      }),
    );
  }
  const [top, right, bottom, left] = getPadding(padding);
  return {
    width: Math.round(dimensions.width + left + right),
    height: Math.round(dimensions.height + top + bottom),
  };
  function expandBox(dim1: Dimensions, dim2: Dimensions) {
    return {
      width: Math.round(Math.max(dim1.width, dim2.width)),
      height: Math.round(dim1.height + dim2.height),
    };
  }

  function getLineDimensions({
    line,
    fontSize = 14,
    getCharWidth = () => fontSize,
  }: {
    line: string;
    fontSize?: number;
    getCharWidth?: (char: string[1]) => number;
  }) {
    return {
      width: line.split("").reduce((w, c) => (w += getCharWidth(c)), 0),
      height: fontSize,
    };
  }
}
