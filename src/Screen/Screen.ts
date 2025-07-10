import tc from "tinycolor2";
import { getBoldColorIndex, namedColors } from "../Color/ansi";
import { Vector, vectorDivideComponents } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Rect, Size } from "../types";
import { Cursor } from "./Cursor";
import { font9x16 } from "./font9x16";
import { getScreenCharacterAttributesFromTermCellAttributes } from "./BufferAdapter";
import { cloneScreenBufferCharacter, ScreenBufferCharacter } from "./types";
import { TextBuffer } from "../TextBuffer/TextBuffer";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

const RENDER_SCALE = 2;

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
  private canvasScale: number = 1;

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

  private graphicsCanvas!: HTMLCanvasElement;
  private graphicsCtx!: CanvasRenderingContext2D;
  private graphicsScale: number = 1;

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

  constructor() {
    this.widthInCharacters = 80;
    this.heightInCharacters = 25;
    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    this.characterWidth = 9;
    this.characterHeight = 16;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.cursor = new Cursor({
      getSize: () => this.getSizeInCharacters(),
    });
    this.curDisplay = true;
    this.curBlinkState = true;
    this.curBlinkDuration = 600;
    this.curBlinkCounter = this.curBlinkDuration;
    this.curStart = 14;
    this.curEnd = 15;

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
        },
      };
    }
  }

  async init(containerEl: HTMLElement) {
    this.initCanvas(containerEl);

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

    this.graphicsCanvas = document.createElement("canvas");
    this.graphicsCanvas.width = this.widthInPixels * this.graphicsScale;
    this.graphicsCanvas.height = this.heightInPixels * this.graphicsScale;
    this.graphicsCtx = this.graphicsCanvas.getContext("2d")!;
    this.graphicsCtx.imageSmoothingEnabled = false;
  }

  initCanvas(containerEl: HTMLElement) {
    const canvasBox = document.createElement("div");
    canvasBox.setAttribute("id", "screen-box");

    const canvas = document.createElement("canvas");
    this.canvas = canvas;

    canvas.setAttribute("id", "screen");
    canvas.setAttribute("width", String(this.widthInPixels * this.canvasScale));
    canvas.setAttribute(
      "height",
      String(this.heightInPixels * this.canvasScale)
    );

    this.ctx = canvas.getContext("2d")!;

    const scanLines = document.createElement("div");

    scanLines.setAttribute("id", "screen-scanlines");

    canvasBox.appendChild(canvas);
    canvasBox.appendChild(scanLines);
    containerEl.replaceChildren(canvasBox);
  }

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.showCursor();
    this.setCursorSize(14, 15);
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

    // clear screen
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // draw background
    this.bufferCtx.globalCompositeOperation = "copy";

    this.bufferCtx.clearRect(
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height
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
      this.bufferCanvas.height
    );
    this.ctx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // draw character layer
    this.bufferCtx.clearRect(
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height
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
      this.bufferCanvas.height
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
              this.characterHeight * this.bufferScale
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
      this.bufferCanvas.height
    );

    // commit characters
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // display graphics
    this.ctx.drawImage(
      this.graphicsCanvas,
      0,
      0,
      this.graphicsCanvas.width,
      this.graphicsCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Clears screen using bgColor, resets fg color to current fgColor, clears char buffer. */
  clear() {
    const { bgCtx, charCtx, attributeCtx, graphicsCtx } = this;

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
      this.attributeCanvas.height
    );

    graphicsCtx.clearRect(
      0,
      0,
      this.graphicsCanvas.width,
      this.graphicsCanvas.height
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
    const { bgCtx, charCtx, attributeCtx, graphicsCtx } = this;

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
      this.characterHeight * this.bgScale
    );

    charCtx.clearRect(
      x * this.characterWidth * this.charScale,
      y * this.characterHeight * this.charScale,
      this.characterWidth * this.charScale,
      this.characterHeight * this.charScale
    );
    const atlasRegion = font9x16.getCharacter(bufferCharacter.character, x);
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
        this.characterHeight * this.charScale
      );
    }

    if (bufferCharacter.attributes.underline) {
      charCtx.globalCompositeOperation = "xor";
      charCtx.fillStyle = "#ffffff";
      const underlineHeight = Math.floor(
        (this.characterHeight * this.charScale) / 10
      );
      charCtx.fillRect(
        x * this.characterWidth * this.charScale,
        (y + 1) * this.characterHeight * this.charScale - underlineHeight,
        this.characterWidth * this.charScale,
        underlineHeight * this.charScale
      );
    }

    // fill attribute
    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = fgColor;
    attributeCtx.fillRect(
      x * this.characterWidth * this.attributeScale,
      y * this.characterHeight * this.attributeScale,
      this.characterWidth * this.attributeScale,
      this.characterHeight * this.attributeScale
    );
  }

  private redrawUnstable() {
    const screenSize = this.getSizeInCharacters();
    const unstableCharacters = font9x16.getUnstableCharacters();
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
        const newCharacter = cloneScreenBufferCharacter(currentCharacter);

        const cellAttr = cell.getAttributes();

        newCharacter.attributes =
          getScreenCharacterAttributesFromTermCellAttributes(cellAttr);

        newCharacter.character = cell.rune;

        this.screenBuffer[this._getScreenBufferIndex(x, y)] = newCharacter;
        this.redrawCharacter(x, y);
        screenChanged = true;

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

    this.graphicsCtx.drawImage(
      image,
      dx * this.graphicsScale,
      dy * this.graphicsScale
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
