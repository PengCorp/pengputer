import { type Vector } from "@Toolbox/Vector";
import { TextBuffer } from "../TextBuffer";
import { type Size } from "../types";
import { Font } from "./Font";
import { TerminalRenderer } from "./TerminalRenderer";
import { TerminalCellBuffer } from "./TerminalCellBuffer";
import { loadFont9x16 } from "./Font9x16";
import { getScreenCharacterAttributesFromTermCellAttributes } from "./BufferAdapter";
import tc from "tinycolor2";
import type { Coord } from "../types";
import { CursorStyle } from "../Std/constants";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

export class Screen {
  private gl!: WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;

  private tb!: TerminalCellBuffer;
  private tr!: TerminalRenderer;
  private font!: Font;

  private cursorVisible: boolean = true;
  private cursorStyle: CursorStyle = CursorStyle.Underscore;
  private cursorBlinkState: boolean = true;
  private cursorBlinkDuration: number = 267;
  private cursorBlinkCounter: number = 267;

  private charBlinkState: boolean = true;
  private charBlinkDuration: number = 267;
  private charBlinkCounter: number = 267;

  private clickListeners: Set<ClickListener> = new Set();
  private spaceCoord!: Coord;

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
    screen.spaceCoord = font.charMap[" "];

    const tr = await TerminalRenderer.create(canvas, gl);
    screen.tr = tr;

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      const pos = screen._getCharacterPosition(event);
      if (pos) {
        for (const listener of screen.clickListeners) {
          listener({ position: pos, mouseButton: event.button });
        }
      }
    };

    canvas.addEventListener("mousedown", handleClick);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    return screen;
  }

  public addClickListener(listener: ClickListener): () => void {
    this.clickListeners.add(listener);
    return () => {
      this.clickListeners.delete(listener);
    };
  }

  private _getCharacterPosition(event: MouseEvent): Vector | null {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const pixelX = (event.clientX - rect.left) * scaleX;
    const pixelY = (event.clientY - rect.top) * scaleY;

    const charX = Math.floor(pixelX / this.font.charSize.w);
    const charY = Math.floor(pixelY / this.font.charSize.h);

    const size = this.tb.getSize();
    if (charX < 0 || charX >= size.w || charY < 0 || charY >= size.h) {
      return null;
    }

    return { x: charX, y: charY };
  }

  public setScreenMode(screenSize: Size) {
    this.tb.__setSize(screenSize);
    this.canvas.width = screenSize.w * this.font.charSize.w;
    this.canvas.height = screenSize.h * this.font.charSize.h;
  }

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.showCursor();
  }

  public draw(dt: number, textBuffer: TextBuffer) {
    this.cursorBlinkCounter -= dt;
    while (this.cursorBlinkCounter <= 0) {
      this.cursorBlinkCounter += this.cursorBlinkDuration;
      this.cursorBlinkState = !this.cursorBlinkState;
    }

    this.charBlinkCounter -= dt;
    while (this.charBlinkCounter <= 0) {
      this.charBlinkCounter += this.charBlinkDuration;
      this.charBlinkState = !this.charBlinkState;
    }

    this._updateFromTextBuffer(textBuffer);

    this.tr.render(this.tb, this.font);
  }

  private _updateFromTextBuffer(textBuffer: TextBuffer) {
    const page = textBuffer.getPage(textBuffer.topLine);
    const size = this.tb.getSize();
    const cursorPos = page.cursor.getPosition();
    const showCursor = this.cursorVisible && this.cursorBlinkState;

    if (textBuffer.bellRequested) {
      const beepEl = document.getElementById("bell") as HTMLAudioElement | null;
      if (beepEl) {
        beepEl.currentTime = 0;
        beepEl.play();
      }
      textBuffer.bellRequested = false;
    }

    for (let y = 0; y < size.h && y < page.size.h; y++) {
      for (let x = 0; x < size.w && x < page.size.w; x++) {
        const cell = page.lines[y]?.cells[x];
        if (!cell) continue;

        const cellAttr = cell.getAttributes();
        const screenAttr =
          getScreenCharacterAttributesFromTermCellAttributes(cellAttr);

        let fgColor = screenAttr.fgColor;
        let bgColor = screenAttr.bgColor;

        if (screenAttr.reverseVideo) {
          const t = fgColor;
          fgColor = bgColor;
          bgColor = t;
        }

        if (screenAttr.halfBright) {
          const f = tc(fgColor).toHsv();
          f.v = f.v / 2;
          fgColor = tc(f).toHexString();
          const b = tc(bgColor).toHsv();
          b.v = b.v / 2;
          bgColor = tc(b).toHexString();
        }

        this.tb.setForegroundColorAt(fgColor, x, y);
        this.tb.setBackgroundColorAt(bgColor, x, y);

        const rune = cell.rune;
        const blinkHidden = screenAttr.blink && !this.charBlinkState;
        const charCoord =
          rune === "\x00" || blinkHidden
            ? this.spaceCoord
            : (this.font.charMap[rune] ?? this.spaceCoord);
        this.tb.setRuneAt(x, y, rune, 0, charCoord.x, charCoord.y);

        // Attribute bits:
        //   bits 0-3:   cursor index
        //   bit 4:      underline
        //   bit 5:      overline
        //   bit 6:      strikethrough
        //   bits 8-11:  borders (top, bottom, left, right)
        let attr = 0;

        if (showCursor && x === cursorPos.x && y === cursorPos.y) {
          attr |= this.cursorStyle;
        }

        if (screenAttr.underline) attr |= 1 << 4;
        if (screenAttr.overline) attr |= 1 << 5;
        if (screenAttr.strikethrough) attr |= 1 << 6;

        attr |= screenAttr.boxed << 8;

        this.tb.setAttributesAt(attr, x, y);
      }
    }
  }

  public getSizeInCharacters(): Size {
    return this.tb.getSize();
  }

  public getCharacterSize(): Size {
    return this.font.charSize;
  }

  //================================================== BIOS FUNCTIONS =========================================

  public showCursor() {
    this.cursorVisible = true;
  }

  public hideCursor() {
    this.cursorVisible = false;
  }

  public setCursorStyle(style: CursorStyle) {
    this.cursorStyle = style;
  }

  public getCursorStyle(): CursorStyle {
    return this.cursorStyle;
  }

  public getCharacterAt(pos: Vector) {
    return this.tb.getRuneAt(pos.x, pos.y);
  }
}
