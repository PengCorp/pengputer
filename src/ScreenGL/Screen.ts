import { type Vector } from "@Toolbox/Vector";
import { TextBuffer } from "../TextBuffer";
import { type Size } from "../types";
import { Font } from "./Font";
import { TerminalRenderer } from "./TerminalRenderer";
import { TerminalCellBuffer } from "./TerminalCellBuffer";
import { loadFont9x16 } from "./Font9x16";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

export class Screen {
  public isDirty: boolean = false;

  private gl!: WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;

  private tb!: TerminalCellBuffer;
  private tr!: TerminalRenderer;
  private font!: Font;

  private constructor() {}

  public static async create(containerEl: HTMLElement) {
    const screen = new Screen();

    const canvasBox = document.createElement("div");
    canvasBox.setAttribute("id", "screen-box");

    const canvas = document.createElement("canvas");
    screen.canvas = canvas;

    canvas.setAttribute("id", "screen");
    canvas.width = 720;
    canvas.height = 400;

    canvasBox.appendChild(canvas);
    containerEl.replaceChildren(canvasBox);

    const gl = canvas.getContext("webgl2");

    if (!gl) {
      throw new Error("Failed to get webgl2 context.");
    }

    screen.gl = gl;

    const tb = new TerminalCellBuffer();
    screen.tb = tb;

    const font = await loadFont9x16(gl);
    screen.font = font;

    const tr = await TerminalRenderer.create(canvas, gl);
    screen.tr = tr;

    return screen;
  }

  public setScreenMode(screenSize: Size, font: Font) {}

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.showCursor();
  }

  public draw(dt: number, textBuffer: TextBuffer) {
    // tb.updateFromTextBuffer(textBuffer);
    this.tr.render(this.tb, this.font);
  }

  public getSizeInCharacters(): Size {
    return this.tb.getSize();
  }

  public getCharacterSize(): Size {
    return this.font.charSize;
  }

  //================================================== BIOS FUNCTIONS =========================================

  public showCursor() {}

  public hideCursor() {}

  public getCharacterAt(pos: Vector) {
    return this.tb.getRuneAt(pos.x, pos.y);
  }
}
