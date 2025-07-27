import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { GRAPHICS_HEIGHT, GRAPHICS_WIDTH } from "./constants";

export class Graphics {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = GRAPHICS_WIDTH;
    this.canvas.height = GRAPHICS_HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;

    this.clear();
  }

  getCanvas() {
    return this.canvas;
  }

  clear() {
    const { ctx, canvas } = this;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const offset of [0, 10, 20, 30, 40, 50, 60, 70]) {
      ctx.strokeStyle = CGA_PALETTE_DICT[CgaColors.LightMagenta];
      ctx.beginPath();
      ctx.moveTo(0.5, 0.5 + offset);
      ctx.lineTo(20.5, 20.5 + offset);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.closePath();

      ctx.strokeStyle = CGA_PALETTE_DICT[CgaColors.LightCyan];
      ctx.beginPath();
      ctx.moveTo(0.5, 0.5 + offset + 3);
      ctx.lineTo(20.5, 20.5 + offset + 3);
      ctx.stroke();
      ctx.closePath();

      ctx.strokeStyle = CGA_PALETTE_DICT[CgaColors.White];
      ctx.beginPath();
      ctx.moveTo(0.5, 0.5 + offset + 6);
      ctx.lineTo(20.5, 20.5 + offset + 6);
      ctx.stroke();
      ctx.closePath();
    }
  }
}
