import tc from "tinycolor2";
import { getBoldColorIndex, namedColors } from "@Color/ansi";
import { type Vector, vectorDivideComponents } from "@Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, type Rect, type Size } from "../types";
import { Cursor } from "./Cursor";
import { font9x16 } from "./font9x16";
import { getScreenCharacterAttributesFromTermCellAttributes } from "./BufferAdapter";
import {
  compareScreenBufferCharacter,
  type ScreenBufferCharacter,
} from "./types";
import {
  BOXED_BOTTOM,
  BOXED_LEFT,
  BOXED_NO_BOX,
  BOXED_RIGHT,
  BOXED_TOP,
  TextBuffer,
} from "../TextBuffer";
import { Font } from "./Font";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { Graphics } from "./Graphics";
import { drawScreen, initScreen } from "./Screen.gl";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

export class Screen {
  private widthInCharacters: number;
  private heightInCharacters: number;
  private totalCharacters: number;

  private characterWidth: number;
  private characterHeight: number;

  private widthInPixels: number;
  private heightInPixels: number;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private gl!: WebGL2RenderingContext;

  public areGraphicsEnabled: boolean = false;
  public graphics: Graphics;

  private cursor: Cursor;
  private curDisplay: boolean;
  private curBlinkState: boolean;
  private curBlinkDuration: number;
  private curBlinkCounter: number;
  /** Pixel of cell to start cursor on. */
  private curStart: number;
  /** Pixel of cell to end cursor on. Inclusive. */
  private curEnd: number;

  private charBlinkState: boolean;
  private charBlinkDuration: number;
  private charBlinkCounter: number;

  private screenBuffer: Array<ScreenBufferCharacter>;

  public isDirty: boolean = false;

  private font: Font;

  constructor() {
    this.font = font9x16;
    this.widthInCharacters = 80;
    this.heightInCharacters = 25;
    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    const characterSize = this.font.getCharacterSize();
    this.characterWidth = characterSize.w;
    this.characterHeight = characterSize.h;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.cursor = new Cursor({
      getSize: () => this.getSizeInCharacters(),
    });
    this.curDisplay = true;
    this.curBlinkState = true;
    this.curBlinkDuration = 600;
    this.curBlinkCounter = this.curBlinkDuration;
    this.curStart = this.characterHeight - 2;
    this.curEnd = this.characterHeight - 1;

    this.charBlinkState = true;
    this.charBlinkDuration = 600;
    this.charBlinkCounter = this.charBlinkDuration;

    this.screenBuffer = new Array(this.totalCharacters);
    for (let i = 0; i < this.totalCharacters; i += 1) {
      this.screenBuffer[i] = {
        character: " ",
        attributes: {
          bgColor: namedColors[namedColors.Black],
          fgColor: namedColors[namedColors.LightGray],
          blink: false,
          bold: false,
          reverseVideo: false,
          underline: false,
          halfBright: false,
          boxed: BOXED_NO_BOX,
        },
      };
    }

    this.graphics = new Graphics();
  }

  async init(containerEl: HTMLElement) {
    this.initCanvas(containerEl);
    initScreen(this.gl);
  }

  initCanvas(containerEl: HTMLElement) {
    const canvasBox = document.createElement("div");
    canvasBox.setAttribute("id", "screen-box");

    const canvas = document.createElement("canvas");
    this.canvas = canvas;

    canvas.setAttribute("id", "screen");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // this.ctx = canvas.getContext("2d")!;
    this.gl = canvas.getContext("webgl2")!;

    const scanLines = document.createElement("div");

    scanLines.setAttribute("id", "screen-scanLines");

    canvasBox.appendChild(canvas);
    canvasBox.appendChild(scanLines);
    containerEl.replaceChildren(canvasBox);
  }

  public setScreenMode(screenSize: Size, font: Font) {
    this.font = font;
    this.widthInCharacters = screenSize.w;
    this.heightInCharacters = screenSize.h;

    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    const characterSize = this.font.getCharacterSize();
    this.characterWidth = characterSize.w;
    this.characterHeight = characterSize.h;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.curStart = this.characterHeight - 2;
    this.curEnd = this.characterHeight - 1;

    this.screenBuffer = new Array(this.totalCharacters);
    for (let i = 0; i < this.totalCharacters; i += 1) {
      this.screenBuffer[i] = {
        character: " ",
        attributes: {
          bgColor: namedColors[namedColors.Black],
          fgColor: namedColors[namedColors.LightGray],
          blink: false,
          bold: false,
          reverseVideo: false,
          underline: false,
          halfBright: false,
          boxed: BOXED_NO_BOX,
        },
      };
    }

    this.isDirty = true;
  }

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.showCursor();
    this.setCursorSize(this.characterHeight - 2, this.characterHeight - 1);
  }

  draw(dt: number) {
    this.curBlinkCounter -= dt;
    while (this.curBlinkCounter <= 0) {
      this.curBlinkCounter += this.curBlinkDuration;
      this.curBlinkState = !this.curBlinkState;
    }

    this.charBlinkCounter -= dt;
    while (this.charBlinkCounter <= 0) {
      this.charBlinkCounter += this.charBlinkDuration;
      this.charBlinkState = !this.charBlinkState;
    }

    // ======================================== WEBGL 2 ==================================================

    const { gl } = this;
    drawScreen(gl);

    // ===================================================================================================
  }

  /** Clears screen using bgColor, resets fg color to current fgColor, clears char buffer. */
  clear() {
    this.isDirty = true;
  }

  getSizeInCharacters(): Size {
    return {
      w: this.widthInCharacters,
      h: this.heightInCharacters,
    };
  }

  getSizeInPixels(): Size {
    return {
      w: this.widthInPixels,
      h: this.heightInPixels,
    };
  }

  getCharacterSize(): Size {
    return {
      w: this.characterWidth,
      h: this.characterHeight,
    };
  }

  //================================================= CANVAS HANDLING ==========================================

  private _getScreenBufferIndex(x: number, y: number) {
    return y * this.widthInCharacters + x;
  }

  //================================================== BIOS FUNCTIONS =========================================

  showCursor() {
    this.curDisplay = true;
  }

  hideCursor() {
    this.curDisplay = false;
  }

  getCursorSize() {
    return { start: this.curStart, end: this.curEnd };
  }

  setCursorSize(start: number, end: number) {
    this.curStart = start;
    this.curEnd = end;
  }

  getCharacterAt(pos: Vector) {
    const { x, y } = pos;
    return this.screenBuffer[this._getScreenBufferIndex(x, y)];
  }

  /*=============================== TERM HANDLING ====================================*/

  update(buffer: TextBuffer) {
    if (this.areGraphicsEnabled) {
      this.graphics.draw();
      return;
    }

    let screenChanged = false;

    const page = buffer.getPage(buffer.topLine);
    this.cursor.setPositionNoWrap(page.cursor.getPosition());

    if (buffer.bellRequested) {
      const beepEl = document.getElementById("bell") as HTMLAudioElement | null;
      if (beepEl) {
        beepEl.currentTime = 0;
        beepEl.play();
      }
      buffer.bellRequested = false;
    }

    for (let y = 0; y < this.heightInCharacters && y < page.size.h; y += 1) {
      for (let x = 0; x < this.widthInCharacters && x < page.size.w; x += 1) {
        const cell = page.lines[y]?.cells[x];
        if (!cell) continue;

        if (!this.isDirty && !buffer.isDirty && !cell.isDirty) continue;

        const currentCharacter =
          this.screenBuffer[this._getScreenBufferIndex(x, y)];

        const cellAttr = cell.getAttributes();

        const newCharacter: ScreenBufferCharacter = {
          attributes:
            getScreenCharacterAttributesFromTermCellAttributes(cellAttr),
          character: cell.rune,
        };

        if (
          !compareScreenBufferCharacter(currentCharacter, newCharacter) ||
          buffer.isDirty
        ) {
          this.screenBuffer[this._getScreenBufferIndex(x, y)] = newCharacter;
          screenChanged = true;
        }

        cell.isDirty = false;
      }
    }

    this.isDirty = false;
    buffer.isDirty = false;
  }

  /*================================ IMAGES ====================================*/

  drawImageAt(image: CanvasImageSource, dx: number, dy: number) {
    while (dx < 0) {
      dx += this.widthInPixels;
    }
    while (dy < 0) {
      dy += this.heightInPixels;
    }
  }

  /*=============================== MOUSE ====================================*/

  private getMousePosition(event: MouseEvent): Vector {
    const canvas = this.canvas;

    const rect = canvas.getBoundingClientRect();

    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = cssX * scaleX;
    const y = cssY * scaleY;

    return { x: Math.floor(x), y: Math.floor(y) };
  }

  addMouseClickListener(listener: ClickListener) {
    const fn = (ev: MouseEvent) => {
      const charSize = this.getCharacterSize();
      listener({
        position: vectorDivideComponents(this.getMousePosition(ev), {
          x: charSize.w,
          y: charSize.h,
        }),
        mouseButton: ev.button,
      });
    };
    this.canvas.addEventListener("mousedown", fn);
    return () => {
      this.canvas.removeEventListener("mousedown", fn);
    };
  }
}
