const SCROLLBACK_LENGTH = 1024;
const BUFFER_WIDTH = 80;
const BUFFER_HEIGHT = 25;

export interface ClassicColor {
  type: "classic";
  index: number;
}
export interface IndexedColor {
  type: "indexed";
  index: number;
}
export interface DirectColor {
  type: "direct";
  r: number;
  g: number;
  b: number;
}

export type Color = ClassicColor | IndexedColor | DirectColor;

export interface CellAttributes {
  fgColor: Color;
  bgColor: Color;
}

export const numberOfAttributes = 2;

class Cell {
  private attributes: CellAttributes;
  private rune: string;

  constructor() {
    this.attributes = {
      fgColor: { type: "classic", index: 0 },
      bgColor: { type: "classic", index: 0 },
    };
    numberOfAttributes === 2;
    this.rune = "\x00";
  }

  public clone(): Cell {
    const c = new Cell();
    c.attributes = {
      fgColor: { ...c.attributes.fgColor },
      bgColor: { ...c.attributes.bgColor },
    };
    numberOfAttributes === 2;
    c.rune = this.rune;
    return c;
  }
}

export interface Line {
  cells: Cell[];
  isWrapped: boolean;
}

class Buffer {
  private lines: Line[];

  constructor({
    bufferWidth,
    bufferHeight = 0,
  }: {
    bufferWidth: number;
    bufferHeight?: number;
  }) {
    this.lines = [];

    if (bufferHeight > 0) {
      for (let i = 0; i < bufferHeight; i += 1) {
        const line: Line = {
          cells: new Array(bufferWidth).fill(null).map(() => new Cell()),
          isWrapped: false,
        };
        this.lines.push(line);
      }
    }
  }

  public scrollLineIn(line: Line) {
    this.lines.push(line);
    if (this.lines.length > SCROLLBACK_LENGTH) {
      this.lines = this.lines.slice(this.lines.length - 1024);
    }
  }
}

export class PengTerm {
  private scrollback: Buffer;
  private screen: Buffer;

  constructor() {
    this.scrollback = new Buffer({ bufferWidth: BUFFER_WIDTH });
    this.screen = new Buffer({
      bufferWidth: BUFFER_WIDTH,
      bufferHeight: BUFFER_HEIGHT,
    });

    console.dir(this);
  }
}

new PengTerm();
