import { Vector } from "../Toolbox/Vector";
import { GRAPHICS_HEIGHT, GRAPHICS_WIDTH } from "./constants";

export type FillStyle = string | CanvasGradient | CanvasPattern;
export class PathBuffer {
  private width = GRAPHICS_WIDTH;
  private height = GRAPHICS_HEIGHT;

  private penPosition: Vector = { x: 0, y: 0 };
  private bitmap: number[];

  constructor() {
    this.bitmap = new Array(this.width * this.height).fill(0);

    this.clear();
  }

  clear() {
    this.bitmap = this.bitmap.fill(0);
  }

  moveTo(x: number, y: number) {
    this.penPosition.x = x;
    this.penPosition.y = y;
  }

  lineTo(x: number, y: number) {
    let { x: x0, y: y0 } = this.penPosition;
    let [x1, y1] = [x, y];

    let dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy,
      e2; /* error value e_xy */

    for (;;) {
      /* loop */
      this.putPixel(x0, y0);
      if (x0 == x1 && y0 == y1) break;
      e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      } /* e_xy+e_x > 0 */
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      } /* e_xy+e_y < 0 */
    }

    this.penPosition.x = x1;
    this.penPosition.y = y1;
  }

  strokePath(ctx: CanvasRenderingContext2D, strokeStyle: FillStyle) {
    const originalFillStyle = ctx.fillStyle;
    ctx.fillStyle = strokeStyle;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.bitmap[y * this.width + x] > 0) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    ctx.fillStyle = originalFillStyle;
  }

  floodFill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    strokeStyle: FillStyle,
  ) {
    const originalFillStyle = ctx.fillStyle;
    ctx.fillStyle = strokeStyle;

    const queue = [[x, y]];
    const filled = new Array(this.width * this.height).fill(0);

    while (queue.length > 0) {
      const point = queue.shift();
      if (point) {
        const [x, y] = point;
        const idx = y * this.width + x;
        if (
          x >= 0 &&
          x < this.width &&
          y >= 0 &&
          y < this.height &&
          this.bitmap[idx] === 0 &&
          filled[idx] === 0
        ) {
          filled[idx] = 1;
          ctx.fillRect(x, y, 1, 1);

          queue.push([x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]);
        }
      }
    }

    ctx.fillStyle = originalFillStyle;
  }

  private putPixel(x: number, y: number) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.bitmap[y * this.width + x] = 1;
    }
  }

  ellipseAt(xc: number, yc: number, rx: number, ry: number) {
    let rx2 = rx * rx;
    let ry2 = ry * ry;

    let two_rx2 = 2 * rx2;
    let two_ry2 = 2 * ry2;

    let x = 0;
    let y = ry;
    let px = 0;
    let py = two_rx2 * y;

    let p = Math.round(ry2 - rx2 * ry + 0.25 * rx2);

    this.putPixel(xc + x, yc + y);
    this.putPixel(xc - x, yc + y);
    this.putPixel(xc + x, yc - y);
    this.putPixel(xc - x, yc - y);

    while (px < py) {
      x++;
      px += two_ry2;
      if (p < 0) {
        p += px + ry2;
      } else {
        y--;
        py -= two_rx2;
        p += px - py + ry2;
      }
      this.putPixel(xc + x, yc + y);
      this.putPixel(xc - x, yc + y);
      this.putPixel(xc + x, yc - y);
      this.putPixel(xc - x, yc - y);
    }

    p = Math.round(
      ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2,
    );
    p = ry2 * (x * x) + rx2 * (y * y) - rx2 * ry2;

    while (y >= 0) {
      y--;
      py -= two_rx2;
      if (p > 0) {
        p += rx2 - py;
      } else {
        x++;
        px += two_ry2;
        p += rx2 - py + px;
      }
      this.putPixel(xc + x, yc + y);
      this.putPixel(xc - x, yc + y);
      this.putPixel(xc + x, yc - y);
      this.putPixel(xc - x, yc - y);
    }
  }
}
