import { Vector } from "../Toolbox/Vector";
import { GRAPHICS_HEIGHT, GRAPHICS_WIDTH } from "./constants";

const palette0 = [
  new Uint8ClampedArray([0, 0, 0, 255]),
  new Uint8ClampedArray([78, 243, 243, 255]),
  new Uint8ClampedArray([243, 78, 243, 255]),
  new Uint8ClampedArray([255, 255, 255, 255]),
];

const palette1 = [
  new Uint8ClampedArray([0, 0, 0, 255]),
  new Uint8ClampedArray([0, 196, 196, 255]),
  new Uint8ClampedArray([196, 0, 196, 255]),
  new Uint8ClampedArray([196, 196, 196, 255]),
];

const palette2 = [
  new Uint8ClampedArray([0, 0, 0, 255]),
  new Uint8ClampedArray([78, 220, 78, 255]),
  new Uint8ClampedArray([220, 78, 78, 255]),
  new Uint8ClampedArray([243, 243, 78, 255]),
];

const palette3 = [
  new Uint8ClampedArray([0, 0, 0, 255]),
  new Uint8ClampedArray([0, 196, 0, 255]),
  new Uint8ClampedArray([196, 0, 0, 255]),
  new Uint8ClampedArray([196, 196, 0, 255]),
];

export class Graphics {
  private width = GRAPHICS_WIDTH;
  private height = GRAPHICS_HEIGHT;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private imageDataObj: ImageData;
  private imageData: ImageData["data"];

  private penPosition: Vector = { x: 0, y: 0 };
  private bitmap: Uint8ClampedArray;

  private palette: Uint8ClampedArray[];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = GRAPHICS_WIDTH;
    this.canvas.height = GRAPHICS_HEIGHT;

    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;

    this.bitmap = new Uint8ClampedArray(this.width * this.height);
    this.bitmap.fill(0);

    this.palette = palette0;

    this.imageDataObj = new ImageData(this.width, this.height, {
      colorSpace: "srgb",
    });
    this.imageData = this.imageDataObj.data;

    this.fillRect(0, 0, this.width, this.height, 0);

    this.resetPath();

    this.drawTest();
  }

  getCanvas() {
    return this.canvas;
  }

  draw() {
    const imageDataObj = this.imageDataObj;
    if (imageDataObj) {
      this.ctx.putImageData(imageDataObj, 0, 0);
    }
  }

  // ============================================================ PATH ============================================================

  resetPath() {
    this.bitmap = this.bitmap.fill(0);
    this.penPosition.x = 0;
    this.penPosition.y = 0;
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
      this.putPathPixel(x0, y0);
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

  strokePath(paletteIdx: number) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let i = y * this.width + x;
        if (this.bitmap[i] > 0) {
          this.putColorPixel(i, paletteIdx);
        }
      }
    }
  }

  floodFill(x: number, y: number, paletteIdx: number) {
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
          this.putColorPixel(idx, paletteIdx);

          queue.push([x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]);
        }
      }
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

    this.putPathPixel(xc + x, yc + y);
    this.putPathPixel(xc - x, yc + y);
    this.putPathPixel(xc + x, yc - y);
    this.putPathPixel(xc - x, yc - y);

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
      this.putPathPixel(xc + x, yc + y);
      this.putPathPixel(xc - x, yc + y);
      this.putPathPixel(xc + x, yc - y);
      this.putPathPixel(xc - x, yc - y);
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
      this.putPathPixel(xc + x, yc + y);
      this.putPathPixel(xc - x, yc + y);
      this.putPathPixel(xc + x, yc - y);
      this.putPathPixel(xc - x, yc - y);
    }
  }

  // ============================================================ OTHER DRAWING ============================================================

  fillRect(x: number, y: number, w: number, h: number, paletteIdx: number) {
    for (let y0 = y; y0 < y + h; y0 += 1) {
      for (let x0 = x; x0 < x + w; x0 += 1) {
        const idx = y0 * this.width + x0;
        this.putColorPixel(idx, paletteIdx);
      }
    }
  }

  private putPathPixel(x: number, y: number) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.bitmap[y * this.width + x] = 1;
    }
  }

  private putColorPixel(i: number, paletteIdx: number) {
    const color = this.palette[paletteIdx];
    const imageDataIdx = i * 4;

    this.imageData[imageDataIdx + 0] = color[0];
    this.imageData[imageDataIdx + 1] = color[1];
    this.imageData[imageDataIdx + 2] = color[2];
    this.imageData[imageDataIdx + 3] = color[3];
  }

  drawTest() {
    for (const offset of [0, 30, 60, 90, 120, 150]) {
      this.moveTo(0, 0 + offset);
      this.lineTo(20, 20 + offset);
      this.strokePath(2);
      this.resetPath();

      this.moveTo(20, 20 + offset);
      this.lineTo(0, 0 + offset + 10);
      this.lineTo(20, 20 + offset + 10);
      this.strokePath(1);
      this.resetPath();

      this.moveTo(20, 20 + offset + 10);
      this.lineTo(0, 0 + offset + 20);
      this.lineTo(20, 20 + offset + 20);
      this.strokePath(3);
      this.resetPath();
    }

    this.moveTo(310, 10);
    this.lineTo(330, 40);
    this.lineTo(310, 70);
    this.lineTo(300, 70);
    this.lineTo(300, 10);
    this.lineTo(310, 10);
    this.strokePath(2);
    this.floodFill(305, 15, 1);
    this.resetPath();

    this.ellipseAt(150, 100, 10, 10);
    this.strokePath(1);
    this.floodFill(150, 100, 3);
    this.resetPath();

    this.ellipseAt(150, 100, 15, 5);
    this.strokePath(2);
    this.floodFill(150, 100, 3);
    this.resetPath();

    this.fillRect(150, 150, 25, 25, 3);
    this.fillRect(155, 155, 15, 15, 2);
  }
}
