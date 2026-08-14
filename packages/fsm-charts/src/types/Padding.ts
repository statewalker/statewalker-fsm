/**
 * Padding type.
 */
export type Padding =
  // Top, right, bottom, and left padding values
  | [number, number, number, number]
  // Vertical and horizontal padding values
  | [number, number]
  // The same as [top, right, bottom, left]
  | number;
