import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
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

  lineTo(_x1: number, _y1: number) {
    // Convert input coordinates to our "low-res" pixel grid coordinates.
    // These are integer coordinates on an abstract grid where each step is 1 unit.
    let x0 = Math.floor(this.penPosition.x);
    let y0 = Math.floor(this.penPosition.y);
    let x1 = Math.floor(_x1);
    let y1 = Math.floor(_y1);

    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);

    // Determine direction of step (1 or -1) on the abstract grid
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;

    let err = dx - dy; // Initial error term for Bresenham's

    while (true) {
      // Draw the pixel at the current (x0, y0) on the actual canvas,
      // scaled by pixelSize
      this.bitmap[y0 * this.width + x0] = 1;

      if (x0 === x1 && y0 === y1) break; // Reached end point

      let e2 = 2 * err; // Double error for next iteration

      // Move in X direction if error allows
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      // Move in Y direction if error allows
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    this.penPosition.x = x1;
    this.penPosition.y = y1;
  }

  strokePath(ctx: CanvasRenderingContext2D, strokeStyle: FillStyle) {
    const originalFillStyle = ctx.fillStyle;
    ctx.fillStyle = strokeStyle;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.bitmap[y * this.width + x] === 1) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    ctx.fillStyle = originalFillStyle;
  }
}
