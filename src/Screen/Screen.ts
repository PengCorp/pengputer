import {
  CGA_BOLD_MAP,
  CGA_PALETTE,
  CGA_PALETTE_DICT,
} from "../Color/cgaPalette";
import { font9x16 } from "./font9x16";
import { CgaColors } from "../Color/types";
import { ScreenBufferCharacter, ScreenCharacterAttributes } from "./types";
import { getRectFromVectorAndSize, Rect, Size } from "../types";
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
  splitStringIntoCharacters,
} from "../Toolbox/String";

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
      bgColor: CGA_PALETTE_DICT["black"],
      fgColor: CGA_PALETTE_DICT["lightGray"],
      blink: false,
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

  /** Resets screen attributes and parameters to sensible defaults. */
  public reset() {
    this.currentAttributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];
    this.currentAttributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
    this.currentAttributes.blink = false;
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
      const curW = this.characterWidth * this.bufferScale;
      const curH = (this.curEnd - this.curStart + 1) * this.bufferScale;
      const curX = cursorPosition.x * this.characterWidth * this.bufferScale;
      const curY =
        (cursorPosition.y * this.characterHeight + this.curStart) *
        this.bufferScale;
      this.bufferCtx.globalCompositeOperation = "xor";
      this.bufferCtx.fillRect(curX, curY, curW, curH);
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

    // fill background
    bgCtx.globalCompositeOperation = "source-over";
    bgCtx.fillStyle = bufferCharacter.attributes.bgColor;
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

    // fill attribute
    attributeCtx.globalCompositeOperation = "source-over";
    attributeCtx.fillStyle = bufferCharacter.attributes.fgColor;
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
    console.log("redraw");
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
    };
  }

  setCurrentAttributes(attributes: ScreenCharacterAttributes) {
    this.currentAttributes = {
      fgColor: attributes.fgColor,
      bgColor: attributes.bgColor,
      blink: attributes.blink,
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

  /** Handles escape code. Index should point to first character after escape character. Returns new index into string just after the escape sequence. */
  private handleEscape(sequence: string): number {
    let index = 0;
    const cmdChar = sequence[index];
    index += 1;
    switch (cmdChar) {
      case "s": {
        const setChar = sequence[index];
        index += 1;
        switch (setChar) {
          case "f": {
            const colorIndex = parseInt(sequence.slice(index, index + 2), 16);
            if (colorIndex >= 0 && colorIndex < CGA_PALETTE.length) {
              this.currentAttributes.fgColor =
                CGA_PALETTE_DICT[CGA_PALETTE[colorIndex]];
            }
            index += 2;
            break;
          }
          case "b": {
            const colorIndex = parseInt(sequence.slice(index, index + 2), 16);
            if (colorIndex >= 0 && colorIndex < CGA_PALETTE.length) {
              this.currentAttributes.bgColor =
                CGA_PALETTE_DICT[CGA_PALETTE[colorIndex]];
            }
            index += 2;
            break;
          }
        }
        break;
      }
      case "i": {
        const fgColor = this.currentAttributes.fgColor;
        const bgColor = this.currentAttributes.bgColor;
        this.currentAttributes.fgColor = bgColor;
        this.currentAttributes.bgColor = fgColor;
        break;
      }
      case "b": {
        const boldCommand = sequence[index];
        index += 1;
        switch (boldCommand) {
          case "s": {
            const boldColor = CGA_BOLD_MAP[this.currentAttributes.fgColor];
            if (boldColor) {
              this.currentAttributes.fgColor = boldColor;
            }
            break;
          }
          case "r": {
            const fgColor = this.currentAttributes.fgColor;
            const result = Object.entries(CGA_BOLD_MAP).find(
              ([k, v]) => v === fgColor
            );
            if (result) {
              this.currentAttributes.fgColor = result[0];
            }
            break;
          }
        }
        break;
      }
      case "r": {
        this.currentAttributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];
        this.currentAttributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
        this.currentAttributes.blink = false;
        break;
      }
      case "f": {
        this.currentAttributes.blink = !this.currentAttributes.blink;
        break;
      }
      default:
        index -= 1;
        break;
    }
    return index;
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
        if (ch === "\x1B") {
          const escapeSequence = getEscapeSequence(chars.slice(i - 1).join(""));
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
}
