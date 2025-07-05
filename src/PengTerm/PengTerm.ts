import { splitStringIntoCharacters } from "../Toolbox/String";
import { Vector } from "../Toolbox/Vector";
import { Size } from "../types";

const SCROLLBACK_LENGTH = 1024;
const BUFFER_WIDTH = 80;
const BUFFER_HEIGHT = 25;

export enum ColorType {
  Classic = 0,
  Indexed = 1,
  Direct = 2,
}

export interface ClassicColor {
  type: ColorType.Classic;
  index: number;
}
export interface IndexedColor {
  type: ColorType.Indexed;
  index: number;
}
export interface DirectColor {
  type: ColorType.Direct;
  r: number;
  g: number;
  b: number;
}

export type Color = ClassicColor | IndexedColor | DirectColor;

export interface CellAttributes {
  fgColor: Color;
  bgColor: Color;
}

class Cell {
  public attributes: CellAttributes;
  public rune: string;
  public dirty: boolean;

  constructor() {
    this.attributes = {
      fgColor: { type: ColorType.Indexed, index: 7 },
      bgColor: { type: ColorType.Indexed, index: 0 },
    };
    this.rune = "\x00";
    this.dirty = true;
  }

  public clone(): Cell {
    const c = new Cell();
    c.attributes = {
      fgColor: { ...c.attributes.fgColor },
      bgColor: { ...c.attributes.bgColor },
    };
    c.rune = this.rune;
    c.dirty = true;
    return c;
  }
}

export class Line {
  public cells: Cell[] = [];
  public isWrapped: boolean = false;

  constructor() {}
}

export class Buffer {
  private lines: Line[];
  private width: number;
  private height: number;

  constructor({
    bufferWidth,
    bufferHeight = 0,
  }: {
    bufferWidth: number;
    bufferHeight?: number;
  }) {
    this.lines = [];
    this.width = bufferWidth;
    this.height = bufferHeight;

    if (bufferHeight > 0) {
      for (let i = 0; i < bufferHeight; i += 1) {
        const line = new Line();
        line.cells = new Array(bufferWidth).fill(null).map(() => new Cell());
        line.isWrapped = false;
        this.lines.push(line);
      }
    }
  }

  /** Scrolls all lines up and adds new line to the bottom of the buffer. */
  public scrollLineIn(line: Line) {
    this.lines.push(line);
    if (this.lines.length > SCROLLBACK_LENGTH) {
      this.lines = this.lines.slice(this.lines.length - SCROLLBACK_LENGTH);
    }
  }

  public getSize(): Size {
    return { w: this.width, h: this.height };
  }

  public getCellAt(pos: Vector) {
    return this.lines[pos.y].cells[pos.x];
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
    return { x: this.x, y: this.y };
  }
}

export class PengTerm {
  private scrollback: Buffer;
  public screen: Buffer;
  public cursor: Cursor;
  private isWrapPending: boolean;

  constructor() {
    this.scrollback = new Buffer({ bufferWidth: BUFFER_WIDTH });
    this.screen = new Buffer({
      bufferWidth: BUFFER_WIDTH,
      bufferHeight: BUFFER_HEIGHT,
    });
    this.cursor = new Cursor();
    this.isWrapPending = false;
  }

  public writeCharacter(character: string) {
    if (this.isWrapPending) {
      this.cursor.x = 0;
      this.cursor.y += 1;
      this.isWrapPending = false;
    }

    const cell = this.screen.getCellAt(this.cursor.getPosition());
    cell.rune = character;
    cell.dirty = true;

    this.cursor.x += 1;
    if (this.cursor.x === this.screen.getSize().w) {
      this.cursor.x -= 1;
      this.isWrapPending = true;
    }
  }

  public write(string: string) {
    const chars = splitStringIntoCharacters(string);

    for (let i = 0; i < string.length; ) {
      this.writeCharacter(chars[i]);
      i += 1;
    }
  }
}
