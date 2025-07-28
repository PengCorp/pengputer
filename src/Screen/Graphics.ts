import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { Vector } from "../Toolbox/Vector";
import { GRAPHICS_HEIGHT, GRAPHICS_WIDTH } from "./constants";
import { BitmapBuffer } from "./Graphics.BitmapBuffer";

export type fillStyle = string;
export class Graphics {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private strokeStyle: fillStyle = "red";
  private fillStyle: fillStyle = "blue";

  private bitmap: BitmapBuffer;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = GRAPHICS_WIDTH;
    this.canvas.height = GRAPHICS_HEIGHT;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;

    this.bitmap = new BitmapBuffer();

    this.clear();

    this.drawTest();
  }

  getCanvas() {
    return this.canvas;
  }

  clear() {
    const { ctx, canvas } = this;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.bitmap.reset();
  }

  drawTest() {
    this.bitmap.start(this.ctx);

    for (const offset of [0, 30, 60, 90, 120, 150]) {
      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
      this.bitmap.moveTo(0, 0 + offset);
      this.bitmap.lineTo(20, 20 + offset);
      this.bitmap.strokePath(this.strokeStyle);
      this.bitmap.reset();

      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.LightCyan]);
      this.bitmap.moveTo(20, 20 + offset);
      this.bitmap.lineTo(0, 0 + offset + 10);
      this.bitmap.lineTo(20, 20 + offset + 10);
      this.bitmap.strokePath(this.strokeStyle);
      this.bitmap.reset();

      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.White]);
      this.bitmap.moveTo(20, 20 + offset + 10);
      this.bitmap.lineTo(0, 0 + offset + 20);
      this.bitmap.lineTo(20, 20 + offset + 20);
      this.bitmap.strokePath(this.strokeStyle);
      this.bitmap.reset();
    }

    this.bitmap.moveTo(310, 10);
    this.bitmap.lineTo(330, 40);
    this.bitmap.lineTo(310, 70);
    this.bitmap.lineTo(300, 70);
    this.bitmap.lineTo(300, 10);
    this.bitmap.lineTo(310, 10);
    this.bitmap.strokePath(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
    this.bitmap.floodFill(305, 15, CGA_PALETTE_DICT[CgaColors.LightCyan]);
    this.bitmap.reset();

    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
    this.fillRect(40, 40, 10, 10);
    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.LightCyan]);
    this.fillRect(45, 45, 10, 10);
    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.White]);
    this.fillRect(50, 50, 10, 10);

    this.bitmap.ellipseAt(150, 100, 10, 10);
    this.bitmap.strokePath(CGA_PALETTE_DICT[CgaColors.LightCyan]);
    this.bitmap.floodFill(150, 100, CGA_PALETTE_DICT[CgaColors.White]);
    this.bitmap.reset();

    this.bitmap.ellipseAt(150, 100, 15, 5);
    this.bitmap.strokePath(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
    this.bitmap.floodFill(150, 100, CGA_PALETTE_DICT[CgaColors.White]);
    this.bitmap.reset();

    this.bitmap.fillRect(
      200,
      200,
      10,
      10,
      CGA_PALETTE_DICT[CgaColors.LightMagenta],
    );

    this.bitmap.fillRect(202, 202, 6, 6, CGA_PALETTE_DICT[CgaColors.White]);

    this.bitmap.end(this.ctx);
  }

  setStrokeStyle(style: fillStyle) {
    this.strokeStyle = style;
  }

  setFillStyle(style: fillStyle) {
    this.fillStyle = style;
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.ctx.fillStyle = this.fillStyle;
    this.ctx.fillRect(x, y, w, h);
  }
}
