import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { Vector } from "../Toolbox/Vector";
import { GRAPHICS_HEIGHT, GRAPHICS_WIDTH } from "./constants";
import { PathBuffer } from "./Graphics.PathBuffer";

export type fillStyle = string | CanvasGradient | CanvasPattern;
export class Graphics {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private strokeStyle: fillStyle = "red";
  private fillStyle: fillStyle = "blue";

  private penPosition: Vector = { x: 0, y: 0 };
  private path: PathBuffer;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = GRAPHICS_WIDTH;
    this.canvas.height = GRAPHICS_HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;

    this.path = new PathBuffer();

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

    this.path.clear();
  }

  drawTest() {
    for (const offset of [0, 30, 60, 90, 120, 150]) {
      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
      this.path.moveTo(0, 0 + offset);
      this.path.lineTo(20, 20 + offset);
      this.path.strokePath(this.ctx, this.strokeStyle);
      this.path.clear();

      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.LightCyan]);
      this.path.lineTo(0, 0 + offset + 10);
      this.path.lineTo(20, 20 + offset + 10);
      this.path.strokePath(this.ctx, this.strokeStyle);
      this.path.clear();

      this.setStrokeStyle(CGA_PALETTE_DICT[CgaColors.White]);
      this.path.lineTo(0, 0 + offset + 20);
      this.path.lineTo(20, 20 + offset + 20);
      this.path.strokePath(this.ctx, this.strokeStyle);
      this.path.clear();
    }

    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.LightMagenta]);
    this.fillRect(40, 40, 10, 10);
    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.LightCyan]);
    this.fillRect(45, 45, 10, 10);
    this.setFillStyle(CGA_PALETTE_DICT[CgaColors.White]);
    this.fillRect(50, 50, 10, 10);
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
