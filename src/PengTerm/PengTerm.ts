import { getIsPrintable } from "../Screen/getIsPrintable";
import { RingBuffer } from "../Toolbox/RingBuffer";
import { splitStringIntoCharacters } from "../Toolbox/String";
import { Vector } from "../Toolbox/Vector";
import { getIsVectorInZeroAlignedRect, Size } from "../types";
import { Color, ColorType } from "./Color";

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
  public isDirty: boolean = false;

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

  private writeCharacter(character: string) {
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

  public write(chars: string[]) {
    while (chars.length > 0) {
      if (chars[0] === "\n") {
        chars.shift();
        this.cursor.x = 0;
        this.cursor.y += 1;
        this.isWrapPending = false;

        if (this.cursor.y === this.pageSize.h) {
          this.cursor.y -= 1;
          this.buffer.push(new Line(this.pageSize.w, this.currentAttributes));
        }
      } else if (chars[0] === "\x1B") {
        const char = chars.shift()!;
        // parse escape
        // chars = applyEscape(chars)
      } else {
        const char = chars.shift()!;
        this.writeCharacter(char);
      }
    }
  }
}

type ScreenKey = "main" | "alternate";

export class PengTerm {
  private mainScreen: Screen;
  private alternateScreen: Screen;

  public screen: Screen;

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
  }

  public write(string: string) {
    let chars = splitStringIntoCharacters(string);
    while (chars.length > 0) {
      this.screen.write(chars);
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
}
