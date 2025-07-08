import { getIsPrintable } from "../Screen/getIsPrintable";
import { char, charArray } from "../types";
import { RingBuffer } from "../Toolbox/RingBuffer";
import { splitStringIntoCharacters } from "../Toolbox/String";
import { Vector } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Size } from "../types";
import { Color, ColorType, isColorValue } from "../Color/Color";
import { ControlCharacter } from "./ControlCharacters";
import { codeToCharacterUS } from "../Keyboard/CharMap";
import { KeyCode } from "../Keyboard/KeyCode";
import { Keyboard } from "../Keyboard/Keyboard";
import { Sequence, SequenceParser } from "./SequenceParser";
import { Signal } from "../Toolbox/Signal";
import { arrowKeyMap } from "../Keyboard/ArrowMap";

const SCROLLBACK_LENGTH = 1024;
const BUFFER_WIDTH = 80;
const BUFFER_HEIGHT = 25;

export interface CellAttributes {
  fgColor: Color;
  bgColor: Color;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
  underline: boolean;
  halfBright: boolean;
}

const cloneCellAttributes = (attr: CellAttributes): CellAttributes => {
  return {
    fgColor: attr.fgColor,
    bgColor: attr.bgColor,
    blink: attr.blink,
    bold: attr.bold,
    reverseVideo: attr.reverseVideo,
    underline: attr.underline,
    halfBright: attr.halfBright,
  };
};

const DEFAULT_ATTRIBUTES: CellAttributes = {
  fgColor: { type: ColorType.Classic, index: 7 },
  bgColor: { type: ColorType.Classic, index: 0 },
  blink: false,
  bold: false,
  reverseVideo: false,
  underline: false,
  halfBright: false,
};

class Cell {
  private attributes: CellAttributes;
  public rune: string;

  public isDirty: boolean;

  constructor() {
    this.attributes = cloneCellAttributes(DEFAULT_ATTRIBUTES);
    this.rune = "\x00";

    this.isDirty = true;
  }

  public getAttributes() {
    return cloneCellAttributes(this.attributes);
  }

  public setAttributes(attr: CellAttributes) {
    this.attributes = attr;
  }

  public clone(): Cell {
    const c = new Cell();

    c.attributes = cloneCellAttributes(this.attributes);
    c.rune = this.rune;

    c.isDirty = true;

    return c;
  }
}

export class Line {
  public cells: Cell[];
  public isWrapped: boolean = false;

  constructor(width: number, attr: CellAttributes) {
    this.cells = new Array(width).fill(null).map(() => {
      const cell = new Cell();
      cell.setAttributes(cloneCellAttributes(attr));
      return cell;
    });
  }
}

export class Cursor {
  private x: number;
  private y: number;
  private isWrapPending: boolean;

  constructor() {
    this.x = 0;
    this.y = 0;
    this.isWrapPending = false;
  }

  public getPosition(): Vector {
    return {
      x: this.x,
      y: this.y,
    };
  }

  public setPosition(pos: Vector, opt: { isWrapPending?: boolean } = {}) {
    this.x = pos.x;
    this.y = pos.y;
    this.isWrapPending = opt.isWrapPending ?? false;
  }

  public getIsWrapPending() {
    return this.isWrapPending;
  }

  public setIsWrapPending(isWrapPending: boolean) {
    return (this.isWrapPending = isWrapPending);
  }

  public clone(): Cursor {
    const c = new Cursor();
    c.x = this.x;
    c.y = this.y;
    return c;
  }

  public getIsInPage(pageSize: Size): boolean {
    if (getIsVectorInZeroAlignedRect({ x: this.x, y: this.y }, pageSize)) {
      return false;
    }
    return true;
  }

  /** If cursor is outside of the page it is returned to the first available position. */
  public snapToPage(pageSize: Size): void {
    this.isWrapPending = false;
    if (this.x < 0) this.x = 0;
    if (this.x >= pageSize.w) this.x = pageSize.w - 1;
    if (this.y < 0) this.y = 0;
    if (this.y >= pageSize.h) this.y = pageSize.h - 1;
  }

  public wrapToBeInsidePage(pageSize: Size): void {
    this.isWrapPending = false;
    while (this.x < 0) {
      this.y -= 1;
      this.x += pageSize.w;
    }
    while (this.x >= pageSize.w) {
      this.y += 1;
      this.x -= pageSize.w;
    }
  }
}

interface Page {
  size: Size;
  lines: Line[];
  cursor: Cursor;
}

export class Screen {
  private buffer: RingBuffer<Line>;
  private currentAttributes: CellAttributes;
  public cursor: Cursor;
  public topLine: number;
  private pageSize: Size;
  public isDirty: boolean;
  public bellRequested: boolean = false;

  constructor({
    pageSize,
    scrollbackLength = 0,
    switchScreen,
  }: {
    pageSize: Size;
    scrollbackLength?: number;
    switchScreen: (key: ScreenKey) => void;
  }) {
    this.buffer = new RingBuffer<Line>(pageSize.h + scrollbackLength);
    this.pageSize = pageSize;
    this.isDirty = true;

    this.currentAttributes = cloneCellAttributes(DEFAULT_ATTRIBUTES);

    for (let i = 0; i < pageSize.h; i += 1) {
      this.buffer.push(new Line(pageSize.w, this.currentAttributes));
    }

    this.cursor = new Cursor();
    this.topLine = 0;
  }

  public getPageSize(): Size {
    return this.pageSize;
  }

  public getPage(offset: number): Page {
    if (offset > 0) {
      offset = 0;
    }
    let savedLines = Math.max(this.buffer.getLength() - this.pageSize.h);
    if (offset < -savedLines) {
      offset = -savedLines;
    }

    const cursor = this.cursor.clone();
    const cursorPosition = cursor.getPosition();
    cursorPosition.y -= offset;
    cursor.setPosition(cursorPosition);

    const lines = this.buffer.slice(-this.pageSize.h + offset, offset);
    for (const l of lines) {
      if (!l) {
        throw new Error("Empty line encountered when building Page.");
      }
    }

    return {
      size: this.pageSize,
      lines: lines as Line[],
      cursor: cursor,
    };
  }

  public printCharacter(character: string) {
    if (!getIsPrintable(character)) {
      return;
    }

    if (this.cursor.getIsWrapPending()) {
      const cursorPosition = this.cursor.getPosition();
      cursorPosition.x = 0;
      cursorPosition.y += 1;

      if (cursorPosition.y === this.pageSize.h) {
        cursorPosition.y -= 1;
        this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
        this.isDirty = true;
      }

      this.cursor.setPosition(cursorPosition);
    }

    const page = this.getPage(0);

    const cursorPosition = this.cursor.getPosition();
    const cell = page.lines[cursorPosition.y]?.cells[cursorPosition.x];
    if (!cell) {
      throw new Error("Unable to get cell.");
    }
    cell.setAttributes(this.currentAttributes);
    cell.rune = character;
    cell.isDirty = true;

    cursorPosition.x += 1;
    if (cursorPosition.x === page.size.w) {
      cursorPosition.x -= 1;
      this.cursor.setPosition(cursorPosition, { isWrapPending: true });
    } else {
      this.cursor.setPosition(cursorPosition);
    }

    this.topLine = 0;
  }

  public bell() {
    this.bellRequested = true;
  }

  public backspace() {
    const curPos = this.cursor.getPosition();
    curPos.x -= 1;
    if (curPos.x < 0) {
      curPos.x = 0;
    }
    this.cursor.setPosition(curPos);
  }

  public lineFeed() {
    const curPos = this.cursor.getPosition();
    curPos.y += 1;
    if (curPos.y === this.pageSize.h) {
      curPos.y -= 1;
      this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
      this.isDirty = true;
    }
    this.cursor.setPosition(curPos);
  }

  public carriageReturn() {
    const curPos = this.cursor.getPosition();
    curPos.x = 0;
    this.cursor.setPosition(curPos);
  }

  public getCurrentAttributes(): CellAttributes {
    return cloneCellAttributes(this.currentAttributes);
  }

  public setCurrentAttributes(attr: CellAttributes): void {
    this.currentAttributes = attr;
  }

  public scrollUpBy(numRows: number): void {
    for (let i = 0; i < numRows; i += 1) {
      this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
    }
    this.isDirty = true;
  }

  public scrollDownBy(numRows: number): void {
    for (let i = 0; i < numRows; i += 1) {
      this.buffer.insertAtWithDiscard(
        -(this.pageSize.h - 1),
        new Line(this.pageSize.w, this.currentAttributes)
      );
    }
    this.isDirty = true;
  }
}

type ScreenKey = "main" | "alternate";

export class PengTerm {
  private mainScreen: Screen;
  private alternateScreen: Screen;

  public screen: Screen;

  private receiveBuffer: charArray = [];
  private sequenceParser = new SequenceParser();

  public sendBuffer: charArray = [];
  public sendBufferUpdateSignal: Signal = new Signal<void>();

  private keyboard: Keyboard;

  private isShift: boolean = false;
  private shiftKeysDown: number = 0;
  private isCaps: boolean = false;
  private isControl: boolean = false;
  private controlKeysDown: number = 0;

  /** New Line Mode: set - getting LF does CR&LF, enter sends CR&LF, reset - getting LF does LF, enter sends CR */
  private lnm: "set" | "reset" = "set";

  /** Send/Receive Mode: set - disable local echo, reset - enable local echo */
  private srm: "set" | "reset" = "set";

  /**
   * Cursor Key Mode: controls what characters are sent from terminal when pressing arrow keys.
   *
   * Set - application keys with SS3, reset - ANSI escape codes for cursor control.
   */
  private ckm: "set" | "reset" = "set";

  constructor(keyboard: Keyboard) {
    this.mainScreen = new Screen({
      pageSize: { w: BUFFER_WIDTH, h: BUFFER_HEIGHT },
      scrollbackLength: SCROLLBACK_LENGTH,
      switchScreen: (key: ScreenKey) => this.switchScreen(key),
    });
    this.alternateScreen = new Screen({
      pageSize: { w: BUFFER_WIDTH, h: BUFFER_HEIGHT },
      switchScreen: (key: ScreenKey) => this.switchScreen(key),
    });

    this.screen = this.mainScreen;
    this.screen.isDirty = true;
    this.keyboard = keyboard;
  }

  private writeCharacter(char: string) {
    switch (char) {
      case ControlCharacter.NUL:
        break;
      case ControlCharacter.BEL:
        this.screen.bell();
        break;
      case ControlCharacter.BS:
        this.screen.backspace();
        break;
      case ControlCharacter.LF:
      case ControlCharacter.VT:
      case ControlCharacter.FF:
        switch (this.lnm) {
          case "reset":
            this.screen.lineFeed();
            break;
          case "set":
            this.screen.carriageReturn();
            this.screen.lineFeed();
            break;
        }
        break;
      case ControlCharacter.CR:
        this.screen.carriageReturn();
        break;
      default:
        this.screen.printCharacter(char);
        break;
    }
  }

  public switchScreen(which: ScreenKey) {
    switch (which) {
      case "main":
        if (this.screen !== this.mainScreen) {
          this.screen = this.mainScreen;
          this.screen.isDirty = true;
        }
        break;
      case "alternate":
        if (this.screen !== this.alternateScreen) {
          this.screen = this.alternateScreen;
          this.screen.isDirty = true;
        }
        break;
    }
  }

  private getCharacterFromCode(code: KeyCode): string | null {
    const map = codeToCharacterUS[code];

    if (map) {
      if (this.isControl) {
        return map.control ?? null;
      } else if (this.isCaps && this.isShift) {
        return map.capsShift ?? map.regular;
      } else if (this.isCaps) {
        return map.caps ?? map.regular;
      } else if (this.isShift) {
        return map.shift ?? map.regular;
      } else {
        return map.regular;
      }
    }

    return null;
  }

  private handleEscapeSequence(sequence: Sequence) {
    // console['log'](`handling: ${JSON.stringify(sequence)}`);
    if (sequence.csiCharacter) {
      const csiParameters = sequence.csiNumericParameters;
      switch (sequence.csiCharacter) {
        case "A": // cursor up
          {
            let howMany = csiParameters?.[0];
            if (howMany === 0 || howMany === undefined) {
              howMany = 1;
            }

            const curPos = this.screen.cursor.getPosition();
            curPos.y -= howMany;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "B": // cursor down
          {
            let howMany = csiParameters?.[0];
            if (howMany === 0 || howMany === undefined) {
              howMany = 1;
            }
            const curPos = this.screen.cursor.getPosition();
            curPos.y += howMany;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "C": // cursor forward
          {
            let howMany = csiParameters?.[0];
            if (howMany === 0 || howMany === undefined) {
              howMany = 1;
            }
            const curPos = this.screen.cursor.getPosition();
            curPos.x += howMany;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "D": // cursor backward
          {
            let howMany = csiParameters?.[0];
            if (howMany === 0 || howMany === undefined) {
              howMany = 1;
            }
            const curPos = this.screen.cursor.getPosition();
            curPos.x -= howMany;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "G": // character absolute (row)
          {
            let x = csiParameters?.[0];
            if (x === 0 || x === undefined) {
              x = 1;
            }
            const curPos = this.screen.cursor.getPosition();
            curPos.x = x - 1;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "H": // cursor absolute (screen)
          {
            let y = csiParameters?.[0];
            let x = csiParameters?.[1];
            if (x === 0 || x === undefined) {
              x = 1;
            }
            if (y === 0 || y === undefined) {
              y = 1;
            }
            const curPos = this.screen.cursor.getPosition();
            curPos.x = x - 1;
            curPos.y = y - 1;
            this.screen.cursor.setPosition(curPos);
            this.screen.cursor.snapToPage(this.screen.getPageSize());
          }
          break;
        case "J": // erase in display
          {
            let what = csiParameters?.[0];
            if (what === undefined) {
              what = 0;
            }
            const curPos = this.screen.cursor.getPosition();
            const page = this.screen.getPage(0);
            const currentAttributes = this.screen.getCurrentAttributes();
            switch (what) {
              case 0:
                for (let x = curPos.x; x < page.size.w; x += 1) {
                  const cell = page.lines[curPos.y].cells[x];
                  cell.rune = " ";
                  cell.setAttributes(currentAttributes);
                  cell.isDirty = true;
                }
                for (let y = curPos.y + 1; y < page.size.h; y += 1) {
                  for (let x = 0; x < page.size.w; x += 1) {
                    const cell = page.lines[y].cells[x];
                    cell.rune = " ";
                    cell.setAttributes(currentAttributes);
                    cell.isDirty = true;
                  }
                }
                break;
              case 1:
                for (let y = 0; y < curPos.y; y += 1) {
                  for (let x = 0; x < page.size.w; x += 1) {
                    const cell = page.lines[y].cells[x];
                    cell.rune = " ";
                    cell.setAttributes(currentAttributes);
                    cell.isDirty = true;
                  }
                }
                for (let x = 0; x <= curPos.x; x += 1) {
                  const cell = page.lines[curPos.y].cells[x];
                  cell.rune = " ";
                  cell.setAttributes(currentAttributes);
                  cell.isDirty = true;
                }
                break;
              case 2:
                for (let y = 0; y < page.size.h; y += 1) {
                  for (let x = 0; x < page.size.w; x += 1) {
                    const cell = page.lines[y].cells[x];
                    cell.rune = " ";
                    cell.setAttributes(currentAttributes);
                    cell.isDirty = true;
                  }
                }
                break;
            }
          }
          break;
        case "S": // scroll up, content moves up
          {
            let lines = csiParameters?.[0];
            if (lines === 0 || lines === undefined) {
              lines = 1;
            }
            this.screen.scrollUpBy(lines);
          }
          break;
        case "T": // scroll down, content moves down
          {
            let lines = csiParameters?.[0];
            if (lines === 0 || lines === undefined) {
              lines = 1;
            }
            this.screen.scrollDownBy(lines);
          }
          break;
        case "m":
          while (csiParameters && csiParameters.length > 0) {
            const num = csiParameters?.shift()!;
            if (num >= 30 && num <= 37) {
              const attr = this.screen.getCurrentAttributes();
              attr.fgColor = {
                type: ColorType.Classic,
                index: num - 30,
              };
              this.screen.setCurrentAttributes(attr);
            } else if (num >= 40 && num <= 47) {
              const attr = this.screen.getCurrentAttributes();
              attr.bgColor = {
                type: ColorType.Classic,
                index: num - 40,
              };
              this.screen.setCurrentAttributes(attr);
            } else if (num >= 90 && num <= 97) {
              const attr = this.screen.getCurrentAttributes();
              attr.fgColor = {
                type: ColorType.Classic,
                index: 8 + num - 90,
              };
              this.screen.setCurrentAttributes(attr);
            } else if (num >= 100 && num <= 107) {
              const attr = this.screen.getCurrentAttributes();
              attr.bgColor = {
                type: ColorType.Classic,
                index: 8 + num - 100,
              };
              this.screen.setCurrentAttributes(attr);
            } else {
              switch (num) {
                case 0:
                  {
                    this.screen.setCurrentAttributes(DEFAULT_ATTRIBUTES);
                  }
                  break;
                case 1:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.bold = true;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 2:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.halfBright = true;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 5:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.blink = true;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 7:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.reverseVideo = true;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 21:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.underline = true;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 22:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.bold = false;
                    attr.halfBright = false;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 24:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.underline = false;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 25:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.blink = false;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 27:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.reverseVideo = false;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 38:
                  {
                    let b = csiParameters.shift();
                    if (b === 2) {
                      let r = csiParameters.shift();
                      let g = csiParameters.shift();
                      let b = csiParameters.shift();
                      if (
                        r &&
                        g &&
                        b &&
                        isColorValue(r) &&
                        isColorValue(g) &&
                        isColorValue(b)
                      ) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.fgColor = {
                          type: ColorType.Direct,
                          r,
                          g,
                          b,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    } else if (b === 5) {
                      let c = csiParameters.shift();
                      if (c !== undefined && c > 0 && c < 256) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.fgColor = {
                          type: ColorType.Indexed,
                          index: c,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    } else if (b === 10) {
                      let c = csiParameters.shift();
                      if (c !== undefined && c > 0 && c < 32) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.fgColor = {
                          type: ColorType.Classic,
                          index: c,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    }
                  }
                  break;
                case 39:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.fgColor = DEFAULT_ATTRIBUTES.fgColor;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
                case 48:
                  {
                    let b = csiParameters.shift();
                    if (b === 2) {
                      let r = csiParameters.shift();
                      let g = csiParameters.shift();
                      let b = csiParameters.shift();
                      if (
                        r &&
                        g &&
                        b &&
                        isColorValue(r) &&
                        isColorValue(g) &&
                        isColorValue(b)
                      ) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.bgColor = {
                          type: ColorType.Direct,
                          r,
                          g,
                          b,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    } else if (b === 5) {
                      let c = csiParameters.shift();
                      if (c !== undefined && c > 0 && c < 256) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.bgColor = {
                          type: ColorType.Indexed,
                          index: c,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    } else if (b === 10) {
                      let c = csiParameters.shift();
                      if (c !== undefined && c > 0 && c < 32) {
                        const attr = this.screen.getCurrentAttributes();
                        attr.bgColor = {
                          type: ColorType.Classic,
                          index: c,
                        };
                        this.screen.setCurrentAttributes(attr);
                      }
                    }
                  }
                  break;
                case 49:
                  {
                    const attr = this.screen.getCurrentAttributes();
                    attr.bgColor = DEFAULT_ATTRIBUTES.bgColor;
                    this.screen.setCurrentAttributes(attr);
                  }
                  break;
              }
            }
          }
          break;
      }
    }
  }

  private drainReceiveBuffer() {
    while (this.receiveBuffer.length > 0) {
      const ch = this.receiveBuffer[0];

      if (
        this.sequenceParser.inProgress ||
        ch === ControlCharacter.ESC ||
        ch === ControlCharacter.CSI
      ) {
        let sequence = this.sequenceParser.parse(this.receiveBuffer);
        if (!sequence) {
          if (this.sequenceParser.isCancelled) {
            continue;
          }
          break;
        }
        this.handleEscapeSequence(sequence);
        continue;
      }

      this.writeCharacter(this.receiveBuffer.shift()!);
    }
  }

  private sendCharacter(ch: char) {
    this.sendBuffer.push(ch);
    if (this.srm === "reset") {
      this.writeCharacter(ch);
    }
    this.sendBufferUpdateSignal.emit();
  }

  public update(dt: number) {
    let ev = this.keyboard.take();
    while (ev) {
      if (ev.code === "ShiftLeft" || ev.code === "ShiftRight") {
        if (ev.pressed) {
          this.shiftKeysDown += 1;
          this.isShift = this.shiftKeysDown > 0;
        } else {
          this.shiftKeysDown = Math.max(this.shiftKeysDown - 1, 0);
          this.isShift = this.shiftKeysDown > 0;
        }
      } else if (ev.code === "ControlLeft" || ev.code === "ControlRight") {
        if (ev.pressed) {
          this.controlKeysDown += 1;
          this.isControl = this.controlKeysDown > 0;
        } else {
          this.controlKeysDown = Math.max(this.controlKeysDown - 1, 0);
          this.isControl = this.controlKeysDown > 0;
        }
      } else if (ev.code === "CapsLock") {
        this.isCaps = ev.pressed;
      } else if (ev.code === "Enter" || ev.code === "NumpadEnter") {
        if (ev.pressed) {
          switch (this.lnm) {
            case "set":
              this.sendCharacter(ControlCharacter.CR);
              this.sendCharacter(ControlCharacter.LF);
              break;
            case "reset":
              this.sendCharacter(ControlCharacter.CR);
              break;
          }
        }
      } else if (
        ev.code === "ArrowUp" ||
        ev.code === "ArrowDown" ||
        ev.code === "ArrowRight" ||
        ev.code === "ArrowLeft"
      ) {
        if (ev.pressed) {
          for (const ch of arrowKeyMap[this.ckm][ev.code]!) {
            this.sendCharacter(ch);
          }
        }
      } else if (ev.pressed) {
        let char = this.getCharacterFromCode(ev.code);
        if (char !== null) {
          this.sendCharacter(char);
        }
      }

      ev = this.keyboard.take();
    }
  }

  public write(string: string) {
    const chars = splitStringIntoCharacters(string);
    for (const ch of chars) {
      this.receiveBuffer.push(ch);
    }
    this.drainReceiveBuffer();
  }
}
