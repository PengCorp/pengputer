import { font9x16 } from "./font9x16";
import {
  cloneScreenBufferCharacter,
  compareScreenBufferCharacter,
  ScreenBufferCharacter,
  ScreenCharacterAttributes,
} from "./types";
import {
  getIsVectorInRect,
  getRectFromVectorAndSize,
  Rect,
  Size,
} from "../types";
import { getIsPrintable } from "./getIsPrintable";
import {
  Vector,
  vectorClamp,
  vectorDivideComponents,
  zeroVector,
} from "../Toolbox/Vector";
import { Cursor } from "./Cursor";
import {
  getEscapeSequence,
  matchControlEscape,
  matchCsiEscape,
  splitStringIntoCharacters,
} from "../Toolbox/String";
import { getBoldColor, x256Color, x256Colors } from "../Color/ansi";
import tc from "tinycolor2";
import { ColorType, PengTerm } from "../PengTerm";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

const RENDER_SCALE = 2;

const isColorValue = (a: number | undefined) => {
  return a !== undefined && a >= 0 && a < 256;
};

const defaultBgColor = x256Colors[x256Color.Black];
const defaultFgColor = x256Colors[x256Color.LightGray];

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

  private currentAttributes: ScreenCharacterAttributes;

  private cursor: Cursor;
  private curDisplay: boolean;
  private curBlinkState: boolean;
  private curBlinkDuration: number;
  private curBlinkCounter: number;
  /** Pixel of cell to start cursor on. */
  private curStart: number;
  /** Pixel of cell to end cursor on. Inclusive. */
  private curEnd: number;

  private isScrollable: boolean;

  private charBlinkState: boolean;
  private charBlinkDuration: number;
  private charBlinkCounter: number;

  private screenBuffer: Array<ScreenBufferCharacter>;

  constructor() {
    this.widthInCharacters = 80;
    this.heightInCharacters = 25;
    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    this.characterWidth = 9;
    this.characterHeight = 16;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.currentAttributes = {
      bgColor: x256Colors[x256Color.Black],
      fgColor: x256Colors[x256Color.LightGray],
      blink: false,
      bold: false,
      reverseVideo: false,
      underline: false,
      halfBright: false,
    };

    this.cursor = new Cursor({
      getSize: () => this.getSizeInCharacters(),
    });
    this.curDisplay = true;
    this.curBlinkState = true;
    this.curBlinkDuration = 600;
    this.curBlinkCounter = this.curBlinkDuration;
    this.curStart = 14;
    this.curEnd = 15;

    this.isScrollable = true;

    this.charBlinkState = true;
    this.charBlinkDuration = 600;
    this.charBlinkCounter = this.charBlinkDuration;

    this.screenBuffer = new Array(this.totalCharacters);
    for (let i = 0; i < this.totalCharacters; i += 1) {
      this.screenBuffer[i] = {
        character: " ",
        attributes: {
          ...this.currentAttributes,
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
    this.attributeCtx.fillStyle = this.currentAttributes.fgColor;
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

  private resetAttributes() {
    this.currentAttributes.bgColor = defaultBgColor;
    this.currentAttributes.fgColor = defaultFgColor;
    this.currentAttributes.blink = false;
    this.currentAttributes.bold = false;
    this.currentAttributes.reverseVideo = false;
    this.currentAttributes.underline = false;
    this.currentAttributes.halfBright = false;
  }

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.resetAttributes();
    this.setIsScrollable(true);
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
        getIsVectorInRect(
          cursorPosition,
          getRectFromVectorAndSize(zeroVector, {
            w: this.widthInPixels,
            h: this.heightInPixels,
          })
        )
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
    bgCtx.fillStyle = this.currentAttributes.bgColor;
    bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);

    attributeCtx.globalCompositeOperation = "source-over";
    charCtx.clearRect(0, 0, this.charCanvas.width, this.charCanvas.height);

    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = this.currentAttributes.fgColor;
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

    this.cursor.moveToStartOfScreen();
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
      fgColor = getBoldColor(fgColor);
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

    // clear graphics
    graphicsCtx.clearRect(
      x * this.characterWidth * this.graphicsScale,
      y * this.characterHeight * this.graphicsScale,
      this.characterWidth * this.graphicsScale,
      this.characterHeight * this.graphicsScale
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

  getCursorPosition(): Vector {
    return this.cursor.getPosition();
  }

  setCursorPosition(pos: Vector) {
    this.cursor.setPosition(pos);
    if (!this.isScrollable) {
      this.cursor.snapToScreen();
    } else {
      this.scrollInCursor();
    }
  }

  setCursorPositionDelta(delta: Vector) {
    this.cursor.moveBy(delta);
    if (!this.isScrollable) {
      this.cursor.snapToScreen();
    } else {
      this.scrollInCursor();
    }
  }

  getCharacterAt(pos: Vector) {
    const { x, y } = pos;
    return this.screenBuffer[this._getScreenBufferIndex(x, y)];
  }

  getCurrentAttributes(): ScreenCharacterAttributes {
    return {
      fgColor: this.currentAttributes.fgColor,
      bgColor: this.currentAttributes.bgColor,
      blink: this.currentAttributes.blink,
      bold: this.currentAttributes.bold,
      reverseVideo: this.currentAttributes.reverseVideo,
      underline: this.currentAttributes.underline,
      halfBright: this.currentAttributes.halfBright,
    };
  }

  setCurrentAttributes(attributes: ScreenCharacterAttributes) {
    this.currentAttributes = {
      fgColor: attributes.fgColor,
      bgColor: attributes.bgColor,
      blink: attributes.blink,
      bold: attributes.bold,
      reverseVideo: attributes.reverseVideo,
      underline: attributes.underline,
      halfBright: attributes.halfBright,
    };
  }

  private replaceCharacterAndAttributesAt(
    character: string,
    attributes: ScreenCharacterAttributes,
    pos: Vector
  ) {
    const { x, y } = pos;
    const bufferCharacter = this.screenBuffer[this._getScreenBufferIndex(x, y)];
    bufferCharacter.character = character;
    bufferCharacter.attributes = { ...attributes };
    this.redrawCharacter(x, y);
  }

  /*================================ TTY EMULATION =============================*/

  private handleControlCharacter(
    match: NonNullable<ReturnType<typeof matchControlEscape>>
  ) {
    return;
  }

  private handleCSISequence(
    match: NonNullable<ReturnType<typeof matchCsiEscape>>
  ) {
    let { attributes, character } = match;

    if (character === "m") {
      if (attributes.length === 0) {
        attributes = [0];
      }
      while (attributes.length > 0) {
        let a = attributes.shift()!;
        if (a >= 30 && a < 38) {
          this.currentAttributes.fgColor = x256Colors[0 + (a - 30)];
        } else if (a >= 40 && a < 48) {
          this.currentAttributes.bgColor = x256Colors[0 + (a - 40)];
        } else if (a >= 90 && a < 98) {
          this.currentAttributes.fgColor = x256Colors[8 + (a - 90)];
        } else if (a >= 100 && a < 108) {
          this.currentAttributes.bgColor = x256Colors[8 + (a - 100)];
        } else {
          switch (a) {
            case 0:
              this.resetAttributes();
              break;
            case 1:
              this.currentAttributes.bold = true;
              break;
            case 2:
              this.currentAttributes.halfBright = true;
              break;
            case 5:
              this.currentAttributes.blink = true;
              break;
            case 7:
              this.currentAttributes.reverseVideo = true;
              break;
            case 21:
              this.currentAttributes.underline = true;
              break;
            case 22:
              this.currentAttributes.bold = false;
              this.currentAttributes.halfBright = false;
              break;
            case 24:
              this.currentAttributes.underline = false;
              break;
            case 25:
              this.currentAttributes.blink = false;
              break;
            case 27:
              this.currentAttributes.reverseVideo = false;
              break;
            case 38:
              {
                let b = attributes.shift();
                if (b === 2) {
                  let r = attributes.shift();
                  let g = attributes.shift();
                  let b = attributes.shift();
                  if (isColorValue(r) && isColorValue(g) && isColorValue(b)) {
                    this.currentAttributes.fgColor = tc({
                      r: r!,
                      g: g!,
                      b: b!,
                    }).toHexString();
                  }
                } else if (b === 5) {
                  let c = attributes.shift();
                  if (c !== undefined && c > 0 && c < x256Colors.length) {
                    this.currentAttributes.fgColor = x256Colors[c];
                  }
                }
              }
              break;
            case 39:
              this.currentAttributes.fgColor = x256Colors[x256Color.LightGray];
              break;
            case 48:
              {
                let b = attributes.shift();
                if (b === 2) {
                  let r = attributes.shift();
                  let g = attributes.shift();
                  let b = attributes.shift();
                  if (isColorValue(r) && isColorValue(g) && isColorValue(b)) {
                    this.currentAttributes.bgColor = tc({
                      r: r!,
                      g: g!,
                      b: b!,
                    }).toHexString();
                  }
                } else if (b === 5) {
                  let c = attributes.shift();
                  if (c !== undefined && c > 0 && c < x256Colors.length) {
                    this.currentAttributes.bgColor = x256Colors[c];
                  }
                }
              }
              break;
            case 49:
              this.currentAttributes.bgColor = x256Colors[x256Color.Black];
              break;
          }
        }
      }
    }
  }

  /** Handles escape code. Index should point to first character after escape character. Returns new index offset just after the escape sequence. */
  private handleEscape(sequence: string): number {
    const csiMatch = matchCsiEscape(`\x1b${sequence}`);
    if (csiMatch) {
      this.handleCSISequence(csiMatch);
    } else {
      const controlMatch = matchControlEscape(`\x1b${sequence}`);
      if (controlMatch) {
        this.handleControlCharacter(controlMatch);
      }
    }
    return sequence.length;
  }

  /** Updates screen by writing a string with provided attributes. */
  displayString(string: string) {
    const chars = splitStringIntoCharacters(string);
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (ch === "\n") {
        this.cursor.moveBy({ x: 0, y: 1 });
        this.cursor.moveToStartOfLine();
        if (!this.isScrollable && this.cursor.getIsOutOfBounds()) {
          this.cursor.moveToEndOfScreen();
          this.cursor.moveToStartOfLine();
        }
      } else if (ch === "\b") {
        this.cursor.moveBy({ x: -1, y: 0 });
        if (!this.isScrollable && this.cursor.getIsOutOfBounds()) {
          this.cursor.moveToStartOfScreen();
        }
        this.replaceCharacterAndAttributesAt(
          " ",
          this.currentAttributes,
          this.cursor.getPosition()
        );
      } else if (getIsPrintable(ch)) {
        this.replaceCharacterAndAttributesAt(
          ch,
          this.currentAttributes,
          this.cursor.getPosition()
        );
        this.cursor.moveBy({ x: 1, y: 0 });
        if (!this.isScrollable && this.cursor.getIsOutOfBounds()) {
          this.cursor.moveToEndOfScreen();
        }
      } else {
        i += 1;
        if (ch === "\x1b") {
          const escapeSequence = getEscapeSequence(
            `\x1b${chars.slice(i).join("")}`
          );
          if (escapeSequence) {
            this.handleEscape(escapeSequence);
            i = i + escapeSequence.length;
          }
        }
        continue;
      }

      if (this.isScrollable) {
        this.scrollInCursor();
      }

      i += 1;
    }
  }

  /*================================ SCROLLING ================================*/

  public setIsScrollable(isScrollable: boolean) {
    this.isScrollable = isScrollable;
  }

  private scrollCanvases(
    src: Rect,
    dst: Rect,
    clear: Rect,
    attributes: ScreenCharacterAttributes
  ) {
    const scrollDraws = [
      {
        ctx: this.bgCtx,
        canvas: this.bgCanvas,
        scale: this.bgScale,
      },
      {
        ctx: this.charCtx,
        canvas: this.charCanvas,
        scale: this.charScale,
      },
      {
        ctx: this.attributeCtx,
        canvas: this.attributeCanvas,
        scale: this.attributeScale,
      },
      {
        ctx: this.graphicsCtx,
        canvas: this.graphicsCanvas,
        scale: this.graphicsScale,
      },
    ];

    for (const { ctx, canvas, scale } of scrollDraws) {
      this.bufferCtx.globalCompositeOperation = "copy";
      this.bufferCtx.drawImage(
        canvas,
        src.x * scale,
        src.y * scale,
        src.w * scale,
        src.h * scale,
        dst.x * this.bufferScale,
        dst.y * this.bufferScale,
        dst.w * this.bufferScale,
        dst.h * this.bufferScale
      );
      ctx.clearRect(dst.x * scale, dst.y * scale, dst.w * scale, dst.h * scale);
      ctx.drawImage(
        this.bufferCanvas,
        0,
        0,
        this.bufferCanvas.width,
        this.bufferCanvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    this.bgCtx.fillStyle = attributes.bgColor;
    this.bgCtx.fillRect(
      clear.x * this.bgScale,
      clear.y * this.bgScale,
      clear.w * this.bgScale,
      clear.h * this.bgScale
    );
    this.charCtx.clearRect(
      clear.x * this.charScale,
      clear.y * this.charScale,
      clear.w * this.charScale,
      clear.h * this.charScale
    );
    this.attributeCtx.fillStyle = attributes.fgColor;
    this.attributeCtx.fillRect(
      clear.x * this.attributeScale,
      clear.y * this.attributeScale,
      clear.w * this.attributeScale,
      clear.h * this.attributeScale
    );

    this.redrawUnstable();
  }

  scrollUpRect(
    rect: Rect,
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    // scroll screen buffer
    for (let y = rect.y + linesToScroll; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y - linesToScroll)] =
          this.screenBuffer[this._getScreenBufferIndex(x, y)];
      }
    }

    // clear new lines
    for (let y = rect.y + rect.h - linesToScroll; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] = {
          character: " ",
          attributes: { ...attributes },
        };
      }
    }

    const copyRect = {
      x: rect.x * this.characterWidth,
      y: (rect.y + linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const copyRectTo = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const clearRect = {
      x: rect.x * this.characterWidth,
      y: (rect.y + rect.h - linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: linesToScroll * this.characterHeight,
    };

    this.scrollCanvases(copyRect, copyRectTo, clearRect, attributes);
  }

  scrollDownRect(
    rect: Rect,
    linesToScroll: number,
    attributes: ScreenCharacterAttributes = this.currentAttributes
  ) {
    // scroll screen buffer
    for (let y = rect.y + rect.h - 1; y >= rect.y + linesToScroll; y -= 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] =
          this.screenBuffer[this._getScreenBufferIndex(x, y - linesToScroll)];
      }
    }

    // clear new lines
    for (let y = rect.y; y < rect.y + linesToScroll; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        this.screenBuffer[this._getScreenBufferIndex(x, y)] = {
          character: " ",
          attributes: { ...attributes },
        };
      }
    }

    const copyRect = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const copyRectTo = {
      x: rect.x * this.characterWidth,
      y: (rect.y + linesToScroll) * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: (rect.h - linesToScroll) * this.characterHeight,
    };
    const clearRect = {
      x: rect.x * this.characterWidth,
      y: rect.y * this.characterHeight,
      w: rect.w * this.characterWidth,
      h: linesToScroll * this.characterHeight,
    };

    this.scrollCanvases(copyRect, copyRectTo, clearRect, attributes);
  }

  /** Scrolls screen so that cursor is inside the screen rect. */
  private scrollInCursor() {
    const finalPosition = this.cursor.getPosition();
    const screenSize = this.getSizeInCharacters();
    if (finalPosition.y >= screenSize.h) {
      this.scrollUpRect(
        getRectFromVectorAndSize(zeroVector, this.getSizeInCharacters()),
        finalPosition.y - (screenSize.h - 1)
      );
      this.cursor.setPosition({
        ...this.cursor.getPosition(),
        y: screenSize.h - 1,
      });
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

  /*=============================== TERM HANDLING ====================================*/

  updateFromTerm(term: PengTerm) {
    const screen = term.screen;

    let screenChanged = false;

    const page = screen.getPage(0);
    this.cursor.setPositionNoWrap(page.cursor.getPosition());

    for (let y = 0; y < this.heightInCharacters && y < page.height; y += 1) {
      for (let x = 0; x < this.widthInCharacters && x < page.width; x += 1) {
        const cell = page.lines[y]?.cells[x];
        if (!cell) continue;

        if (!term.screenDirty && !cell.dirty) continue;

        const currentCharacter =
          this.screenBuffer[this._getScreenBufferIndex(x, y)];
        const newCharacter = cloneScreenBufferCharacter(currentCharacter);

        const cellFgColor = cell.attributes.fgColor;
        const cellBgColor = cell.attributes.bgColor;

        let fgColor = "black";
        switch (cellFgColor.type) {
          case ColorType.Classic:
            fgColor = x256Colors[cellFgColor.index];
            break;
          case ColorType.Indexed:
            fgColor = x256Colors[cellFgColor.index];
            break;
          case ColorType.Direct:
            fgColor = tc(cellFgColor).toHexString();
            break;
        }

        let bgColor = "black";
        switch (cellBgColor.type) {
          case ColorType.Classic:
            bgColor = x256Colors[cellBgColor.index];
            break;
          case ColorType.Indexed:
            bgColor = x256Colors[cellBgColor.index];
            break;
          case ColorType.Direct:
            bgColor = tc(cellBgColor).toHexString();
            break;
        }

        newCharacter.character = cell.rune;

        newCharacter.attributes.fgColor = fgColor;
        newCharacter.attributes.bgColor = bgColor;

        if (!compareScreenBufferCharacter(currentCharacter, newCharacter)) {
          this.screenBuffer[this._getScreenBufferIndex(x, y)] = newCharacter;
          this.redrawCharacter(x, y);
          screenChanged = true;
        }

        cell.dirty = false;
      }
    }

    term.screenDirty = false;

    if (screenChanged) {
      this.redrawUnstable();
    }
  }
}
