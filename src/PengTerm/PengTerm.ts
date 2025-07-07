import { getIsPrintable } from "../Screen/getIsPrintable";
import { char, charArray } from "../types";
import { RingBuffer } from "../Toolbox/RingBuffer";
import { splitStringIntoCharacters } from "../Toolbox/String";
import { Vector } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Size } from "../types";
import { Color, ColorType } from "./Color";
import { ControlCharacter } from "./ControlCharacters";
import { codeToCharacterUS } from "./Keyboard/CharMap";
import { KeyCode } from "./Keyboard/KeyCode";
import { Keyboard } from "./Keyboard/types";
import { WindowKeyboard } from "./Keyboard/WindowKeyboard";
import { Sequence, SequenceParser } from "./SequenceParser";

const SCROLLBACK_LENGTH = 1024;
const BUFFER_WIDTH = 80;
const BUFFER_HEIGHT = 25;

export interface CellAttributes {
  fgColor: Color;
  bgColor: Color;
}

class Cell {
  public attributes: CellAttributes;
  public rune: string;

  public isDirty: boolean;

  constructor() {
    this.attributes = {
      fgColor: { type: ColorType.Indexed, index: 0 },
      bgColor: { type: ColorType.Indexed, index: 0 },
    };
    this.rune = "\x00";

    this.isDirty = true;
  }

  public clone(): Cell {
    const c = new Cell();

    c.attributes = {
      fgColor: c.attributes.fgColor,
      bgColor: c.attributes.bgColor,
    };
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
      cell.attributes = { ...attr };
      return cell;
    });
  }
}

export class Cursor {
  public x: number;
  public y: number;

  constructor() {
    this.x = 0;
    this.y = 0;
  }

  public getPosition(): Vector {
    return {
      x: this.x,
      y: this.y,
    };
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
}

interface Page {
  size: Size;
  lines: Line[];
  cursor: Cursor;
}

export class Screen {
  private buffer: RingBuffer<Line>;
  private currentAttributes: CellAttributes;
  private isWrapPending: boolean;
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
    this.isWrapPending = false;
    this.isDirty = true;

    this.currentAttributes = {
      fgColor: { type: ColorType.Indexed, index: 7 },
      bgColor: { type: ColorType.Indexed, index: 0 },
    };

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
    cursor.y -= offset;

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

    if (this.isWrapPending) {
      this.cursor.x = 0;
      this.cursor.y += 1;
      this.isWrapPending = false;

      if (this.cursor.y === this.pageSize.h) {
        this.cursor.y -= 1;
        this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
        this.isDirty = true;
      }
    }

    const page = this.getPage(0);

    const cell = page.lines[this.cursor.y]?.cells[this.cursor.x];
    if (!cell) {
      throw new Error("Unable to get cell.");
    }
    cell.attributes = this.currentAttributes;
    cell.rune = character;
    cell.isDirty = true;

    this.cursor.x += 1;
    if (this.cursor.x === page.size.w) {
      this.cursor.x -= 1;
      this.isWrapPending = true;
    }

    this.topLine = 0;
  }

  public bell() {
    this.bellRequested = true;
  }

  public backspace() {
    this.cursor.x -= 1;
    if (this.cursor.x < 0) {
      this.cursor.x = 0;
    }
  }

  public lineFeed() {
    this.cursor.y += 1;
    this.isWrapPending = false;

    if (this.cursor.y === this.pageSize.h) {
      this.cursor.y -= 1;
      this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
      this.isDirty = true;
    }
  }

  public carriageReturn() {
    this.cursor.x = 0;
  }
}

type ScreenKey = "main" | "alternate";

export class PengTerm {
  private mainScreen: Screen;
  private alternateScreen: Screen;

  public screen: Screen;

  private receiveBuffer: charArray = [];
  public sendBuffer: charArray = [];
  private sequenceParser = new SequenceParser();

  private keyboard: Keyboard;

  private isShift: boolean = false;
  private shiftKeysDown: number = 0;
  private isCaps: boolean = false;
  private isControl: boolean = false;
  private controlKeysDown: number = 0;

  /** New Line Mode: set - getting LF does CR&LF, enter sends CR&LF, reset - getting LF does LF, enter sends CR */
  private lnm: "set" | "reset" = "set";

  /** Send/Receive Mode: set - disable local echo, reset - enable local echo */
  private srm: "set" | "reset" = "reset";

  constructor() {
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

    this.keyboard = new WindowKeyboard();
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
    console.log(`handling: ${JSON.stringify(sequence)}`);
  }

  private drainReceive() {
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
  }

  public update(dt: number) {
    this.drainReceive();

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
      } else if (ev.pressed) {
        let char = this.getCharacterFromCode(ev.code);
        if (char !== null) {
          this.sendCharacter(char);
        }
      }

      ev = this.keyboard.take();
    }
  }

  public receive(string: string) {
    const chars = splitStringIntoCharacters(string);
    for (const ch of chars) {
      this.receiveBuffer.push(ch);
    }
  }
}
