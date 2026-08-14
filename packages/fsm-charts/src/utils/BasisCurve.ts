// This file contains the implementation of the BasisCurve class
// copied from d3-shape/src/curve/basis.ts (Mike Bostock, MIT License)

export type DrawContext = {
  bezierCurveTo(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
};

export class BasisCurve {
  _context: DrawContext;
  _x0: number = 0;
  _y0: number = 0;
  _x1: number = 0;
  _y1: number = 0;
  _point: number = 0;
  _line: number = 0;
  constructor(context: DrawContext) {
    this._context = context;
  }
  $point(x: number, y: number) {
    this._context.bezierCurveTo(
      (2 * this._x0 + this._x1) / 3,
      (2 * this._y0 + this._y1) / 3,
      (this._x0 + 2 * this._x1) / 3,
      (this._y0 + 2 * this._y1) / 3,
      (this._x0 + 4 * this._x1 + x) / 6,
      (this._y0 + 4 * this._y1 + y) / 6,
    );
  }

  areaStart() {
    this._line = 0;
  }

  areaEnd() {
    this._line = NaN;
  }

  lineStart() {
    this._x0 = this._x1 = this._y0 = this._y1 = NaN;
    this._point = 0;
  }

  lineEnd() {
    switch (this._point) {
      case 3:
        this.$point(this._x1, this._y1); // falls through
      case 2:
        this._context.lineTo(this._x1, this._y1);
        break;
    }
    if (this._line || (this._line !== 0 && this._point === 1))
      this._context.closePath();
    this._line = 1 - this._line;
  }

  point(x: number, y: number) {
    (x = +x), (y = +y);
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._context.lineTo(
          (5 * this._x0 + this._x1) / 6,
          (5 * this._y0 + this._y1) / 6,
        ); // falls through
      default:
        this.$point(x, y);
        break;
    }
    (this._x0 = this._x1), (this._x1 = x);
    (this._y0 = this._y1), (this._y1 = y);
  }
}
