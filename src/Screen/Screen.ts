import tc from "tinycolor2";
import { getBoldColorIndex, namedColors } from "../Color/ansi";
import { Vector, vectorDivideComponents } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Rect, Size } from "../types";
import { Cursor } from "./Cursor";
import { font9x16 } from "./font9x16";
import { getScreenCharacterAttributesFromTermCellAttributes } from "./BufferAdapter";
import { compareScreenBufferCharacter, ScreenBufferCharacter } from "./types";
import {
  BOXED_BOTTOM,
  BOXED_LEFT,
  BOXED_NO_BOX,
  BOXED_RIGHT,
  BOXED_TOP,
  TextBuffer,
} from "../TextBuffer";
import { Font } from "./Font";
import { CANVAS_HEIGHT, CANVAS_WIDTH, RENDER_SCALE } from "./constants";
import { Graphics } from "./Graphics";

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

  private textCanvas!: HTMLCanvasElement;
  private textCtx!: CanvasRenderingContext2D;
  private textScale: number = 1;

  private bufferCanvas!: HTMLCanvasElement;
  private bufferCtx!: CanvasRenderingContext2D;
  private bufferScale: number = RENDER_SCALE;

  private bgCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private bgScale: number = 1;

  private charCanvas!: HTMLCanvasElement;
  private charCtx!: CanvasRenderingContext2D;
  private charScale: number = RENDER_SCALE;

  private attributeCanvas!: HTMLCanvasElement;
  private attributeCtx!: CanvasRenderingContext2D;
  private attributeScale: number = 1;

  private imagesCanvas!: HTMLCanvasElement;
  private imagesCtx!: CanvasRenderingContext2D;
  private imagesScale: number = 1;

  private tempCanvas!: HTMLCanvasElement;
  private tempCtx!: CanvasRenderingContext2D;
  private tempScale: number = RENDER_SCALE;

  public areGraphicsEnabled: boolean = false;
  private graphics: Graphics;

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

    this.textCanvas = document.createElement("canvas");
    this.textCanvas.width = this.widthInPixels * this.textScale;
    this.textCanvas.height = this.heightInPixels * this.textScale;
    this.textCtx = this.textCanvas.getContext("2d")!;

    this.bufferCanvas = document.createElement("canvas");
    this.bufferCanvas.width = this.widthInPixels * this.bufferScale;
    this.bufferCanvas.height = this.heightInPixels * this.bufferScale;
    this.bufferCtx = this.bufferCanvas.getContext("2d")!;
    this.bufferCtx.imageSmoothingEnabled = false;
    this.bufferCtx.fillStyle = "white";

    this.bgCanvas = document.createElement("canvas");
    this.bgCanvas.width = this.widthInPixels * this.bgScale;
    this.bgCanvas.height = this.heightInPixels * this.bgScale;
    this.bgCtx = this.bgCanvas.getContext("2d")!;
    this.bgCtx.imageSmoothingEnabled = false;

    this.charCanvas = document.createElement("canvas");
    this.charCanvas.width = this.widthInPixels * this.charScale;
    this.charCanvas.height = this.heightInPixels * this.charScale;
    this.charCtx = this.charCanvas.getContext("2d")!;
    this.charCtx.imageSmoothingEnabled = false;
    this.charCtx.fillStyle = "white";

    this.attributeCanvas = document.createElement("canvas");
    this.attributeCanvas.width = this.widthInPixels * this.attributeScale;
    this.attributeCanvas.height = this.heightInPixels * this.attributeScale;
    this.attributeCtx = this.attributeCanvas.getContext("2d")!;
    this.attributeCtx.imageSmoothingEnabled = false;
    this.attributeCtx.fillStyle = "red";
    this.attributeCtx.fillRect(0, 0, this.widthInPixels, this.heightInPixels);

    this.imagesCanvas = document.createElement("canvas");
    this.imagesCanvas.width = this.widthInPixels * this.imagesScale;
    this.imagesCanvas.height = this.heightInPixels * this.imagesScale;
    this.imagesCtx = this.imagesCanvas.getContext("2d")!;
    this.imagesCtx.imageSmoothingEnabled = false;

    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = this.widthInPixels * this.tempScale;
    this.tempCanvas.height = this.heightInPixels * this.tempScale;
    this.tempCtx = this.tempCanvas.getContext("2d")!;
    this.tempCtx.imageSmoothingEnabled = false;
  }

  initCanvas(containerEl: HTMLElement) {
    const canvasBox = document.createElement("div");
    canvasBox.setAttribute("id", "screen-box");

    const canvas = document.createElement("canvas");
    this.canvas = canvas;

    canvas.setAttribute("id", "screen");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    this.ctx = canvas.getContext("2d")!;

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

    this.textCanvas.width = this.widthInPixels * this.textScale;
    this.textCanvas.height = this.heightInPixels * this.textScale;

    this.bufferCanvas.width = this.widthInPixels * this.bufferScale;
    this.bufferCanvas.height = this.heightInPixels * this.bufferScale;

    this.bgCanvas.width = this.widthInPixels * this.bgScale;
    this.bgCanvas.height = this.heightInPixels * this.bgScale;

    this.charCanvas.width = this.widthInPixels * this.charScale;
    this.charCanvas.height = this.heightInPixels * this.charScale;

    this.attributeCanvas.width = this.widthInPixels * this.attributeScale;
    this.attributeCanvas.height = this.heightInPixels * this.attributeScale;

    this.imagesCanvas.width = this.widthInPixels * this.imagesScale;
    this.imagesCanvas.height = this.heightInPixels * this.imagesScale;

    this.tempCanvas.width = this.widthInPixels * this.tempScale;
    this.tempCanvas.height = this.heightInPixels * this.tempScale;

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

    // display graphics
    if (this.areGraphicsEnabled) {
      const graphicsCanvas = this.graphics.getCanvas();
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(
        graphicsCanvas,
        0,
        0,
        graphicsCanvas.width,
        graphicsCanvas.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      this.ctx.imageSmoothingEnabled = true;
      return;
    }

    // clear screen
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.textCtx.globalCompositeOperation = "source-over";
    this.textCtx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // draw background
    this.bufferCtx.globalCompositeOperation = "copy";

    this.bufferCtx.clearRect(
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
    );
    this.bufferCtx.drawImage(
      this.bgCanvas,
      0,
      0,
      this.bgCanvas.width,
      this.bgCanvas.height,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
    );
    this.textCtx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
      0,
      0,
      this.textCanvas.width,
      this.textCanvas.height,
    );

    // draw character layer
    this.bufferCtx.clearRect(
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
    );
    this.bufferCtx.globalCompositeOperation = "source-over";
    this.bufferCtx.drawImage(
      this.charCanvas,
      0,
      0,
      this.charCanvas.width,
      this.charCanvas.height,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
    );

    // clear blinking characters
    if (this.charBlinkState === false) {
      for (let y = 0; y < this.heightInCharacters; y += 1) {
        for (let x = 0; x < this.widthInCharacters; x += 1) {
          const ch = this.getCharacterAt({ x, y });
          if (ch.attributes.blink) {
            this.bufferCtx.clearRect(
              x * this.characterWidth * this.bufferScale,
              y * this.characterHeight * this.bufferScale,
              this.characterWidth * this.bufferScale,
              this.characterHeight * this.bufferScale,
            );
          }
        }
      }
    }

    // draw cursor
    if (this.curDisplay && this.curBlinkState) {
      const cursorPosition = this.cursor.getPosition();
      if (
        getIsVectorInZeroAlignedRect(cursorPosition, {
          w: this.widthInPixels,
          h: this.heightInPixels,
        })
      ) {
        const curW = this.characterWidth * this.bufferScale;
        const curH = (this.curEnd - this.curStart + 1) * this.bufferScale;
        const curX = cursorPosition.x * this.characterWidth * this.bufferScale;
        const curY =
          (cursorPosition.y * this.characterHeight + this.curStart) *
          this.bufferScale;
        this.bufferCtx.globalCompositeOperation = "xor";
        this.bufferCtx.fillStyle =
          this.screenBuffer[
            this._getScreenBufferIndex(cursorPosition.x, cursorPosition.y)
          ].attributes.fgColor;
        this.bufferCtx.fillRect(curX, curY, curW, curH);
      }
    }

    // apply attribute layer
    this.bufferCtx.globalCompositeOperation = "source-atop";
    this.bufferCtx.drawImage(
      this.attributeCanvas,
      0,
      0,
      this.attributeCanvas.width,
      this.attributeCanvas.height,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
    );

    // commit characters
    this.textCtx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
      0,
      0,
      this.textCanvas.width,
      this.textCanvas.height,
    );

    // display images
    this.textCtx.drawImage(
      this.imagesCanvas,
      0,
      0,
      this.imagesCanvas.width,
      this.imagesCanvas.height,
      0,
      0,
      this.textCanvas.width,
      this.textCanvas.height,
    );

    // display text layer
    this.ctx.drawImage(
      this.textCanvas,
      0,
      0,
      this.textCanvas.width,
      this.textCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }

  /** Clears screen using bgColor, resets fg color to current fgColor, clears char buffer. */
  clear() {
    const { bgCtx, charCtx, attributeCtx, imagesCtx } = this;

    bgCtx.globalCompositeOperation = "source-over";
    bgCtx.fillStyle = "black";
    bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);

    attributeCtx.globalCompositeOperation = "source-over";
    charCtx.clearRect(0, 0, this.charCanvas.width, this.charCanvas.height);

    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = "white";
    attributeCtx.fillRect(
      0,
      0,
      this.attributeCanvas.width,
      this.attributeCanvas.height,
    );

    imagesCtx.clearRect(
      0,
      0,
      this.imagesCanvas.width,
      this.imagesCanvas.height,
    );

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

  private redrawCharacter(x: number, y: number) {
    const bufferCharacter = this.screenBuffer[this._getScreenBufferIndex(x, y)];
    const isCharacterVisible = bufferCharacter.character !== " ";

    const { bgCtx, charCtx, attributeCtx } = this;

    let fgColor = bufferCharacter.attributes.fgColor;
    if (bufferCharacter.attributes.bold) {
      fgColor = getBoldColorIndex(fgColor);
    }

    let bgColor = bufferCharacter.attributes.bgColor;

    if (bufferCharacter.attributes.reverseVideo) {
      let t = fgColor;
      fgColor = bgColor;
      bgColor = t;
    }

    if (bufferCharacter.attributes.halfBright) {
      const f = tc(fgColor).toHsv();
      f.v = f.v / 2;
      fgColor = tc(f).toHexString();
      const b = tc(bgColor).toHsv();
      b.v = b.v / 2;
      bgColor = tc(b).toHexString();
    }

    // fill background
    bgCtx.globalCompositeOperation = "source-over";
    bgCtx.fillStyle = bgColor;
    bgCtx.fillRect(
      x * this.characterWidth * this.bgScale,
      y * this.characterHeight * this.bgScale,
      this.characterWidth * this.bgScale,
      this.characterHeight * this.bgScale,
    );

    charCtx.clearRect(
      x * this.characterWidth * this.charScale,
      y * this.characterHeight * this.charScale,
      this.characterWidth * this.charScale,
      this.characterHeight * this.charScale,
    );

    if (isCharacterVisible) {
      const atlasRegion = this.font.getCharacter(bufferCharacter.character, x);
      if (atlasRegion) {
        const { canvas, x: cx, y: cy, w: cw, h: ch } = atlasRegion;

        // fill character
        charCtx.globalCompositeOperation = "source-over";
        charCtx.drawImage(
          canvas,
          cx,
          cy,
          cw,
          ch,
          x * this.characterWidth * this.charScale,
          y * this.characterHeight * this.charScale,
          this.characterWidth * this.charScale,
          this.characterHeight * this.charScale,
        );
      }
    }

    if (bufferCharacter.attributes.boxed) {
      const boxedAttr = bufferCharacter.attributes.boxed;

      const tempCtx = this.tempCtx;
      tempCtx.reset();

      // Uncomment below to make the box rounder.
      tempCtx.globalCompositeOperation = "xor";

      tempCtx.fillStyle = "#ffffff";
      const boxBorderWidth = 1;

      if (boxedAttr & BOXED_BOTTOM) {
        tempCtx.fillRect(
          0,
          (this.characterHeight - boxBorderWidth) * this.charScale,
          this.characterWidth * this.charScale,
          boxBorderWidth * this.charScale,
        );
      }

      if (boxedAttr & BOXED_TOP) {
        tempCtx.fillRect(
          0,
          0,
          this.characterWidth * this.charScale,
          boxBorderWidth * this.charScale,
        );
      }

      if (boxedAttr & BOXED_LEFT) {
        tempCtx.fillRect(
          0,
          0,
          1 * this.charScale,
          this.characterHeight * this.charScale,
        );
      }

      if (boxedAttr & BOXED_RIGHT) {
        tempCtx.fillRect(
          (this.characterWidth - boxBorderWidth) * this.charScale,
          0,
          1 * this.charScale,
          this.characterHeight * this.charScale,
        );
      }

      charCtx.globalCompositeOperation = "xor";
      charCtx.drawImage(
        this.tempCanvas,
        0,
        0,
        this.characterWidth * this.charScale,
        this.characterHeight * this.charScale,
        x * this.characterWidth * this.charScale,
        y * this.characterHeight * this.charScale,
        this.characterWidth * this.charScale,
        this.characterHeight * this.charScale,
      );
    } else if (bufferCharacter.attributes.underline) {
      charCtx.globalCompositeOperation = "xor";
      charCtx.fillStyle = "#ffffff";
      const underlineHeight = Math.floor(this.characterHeight / 8);
      charCtx.fillRect(
        x * this.characterWidth * this.charScale,
        ((y + 1) * this.characterHeight - underlineHeight) * this.charScale,
        this.characterWidth * this.charScale,
        underlineHeight * this.charScale,
      );
    }

    // fill attribute
    if (isCharacterVisible) {
      attributeCtx.globalCompositeOperation = "source-over";
      attributeCtx.fillStyle = fgColor;
      attributeCtx.fillRect(
        x * this.characterWidth * this.attributeScale,
        y * this.characterHeight * this.attributeScale,
        this.characterWidth * this.attributeScale,
        this.characterHeight * this.attributeScale,
      );
    } else {
      attributeCtx.clearRect(
        x * this.characterWidth * this.attributeScale,
        y * this.characterHeight * this.attributeScale,
        this.characterWidth * this.attributeScale,
        this.characterHeight * this.attributeScale,
      );
    }
  }

  private redrawUnstable() {
    const screenSize = this.getSizeInCharacters();
    const unstableCharacters = this.font.getUnstableCharacters();
    for (let y = 0; y < screenSize.h; y += 1) {
      for (let x = 0; x < screenSize.w; x += 1) {
        const char = this.screenBuffer[this._getScreenBufferIndex(x, y)];

        const isUnstable = unstableCharacters.includes(char.character);
        if (isUnstable) {
          this.redrawCharacter(x, y);
        }
      }
    }
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

  updateFromBuffer(buffer: TextBuffer) {
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
          this.redrawCharacter(x, y);
          screenChanged = true;
        }

        cell.isDirty = false;
      }
    }

    this.isDirty = false;
    buffer.isDirty = false;

    if (screenChanged) {
      this.redrawUnstable();
    }
  }

  /*================================ IMAGES ====================================*/

  drawImageAt(image: CanvasImageSource, dx: number, dy: number) {
    while (dx < 0) {
      dx += this.widthInPixels;
    }
    while (dy < 0) {
      dy += this.heightInPixels;
    }

    this.imagesCtx.drawImage(
      image,
      dx * this.imagesScale,
      dy * this.imagesScale,
    );
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
