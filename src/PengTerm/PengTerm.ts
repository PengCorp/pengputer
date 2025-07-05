const SCROLLBACK_LENGTH = 1024;
const BUFFER_WIDTH = 80;
const BUFFER_HEIGHT = 25;

enum ColorType {
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
  private attributes: CellAttributes;
  private rune: string;

  constructor() {
    this.attributes = {
      fgColor: { type: ColorType.Indexed, index: 0 },
      bgColor: { type: ColorType.Indexed, index: 0 },
    };
    this.rune = "\x00";
  }

  public clone(): Cell {
    const c = new Cell();
    c.attributes = {
      fgColor: { ...c.attributes.fgColor },
      bgColor: { ...c.attributes.bgColor },
    };
    c.rune = this.rune;
    return c;
  }
}

export class Line {
  public cells: Cell[] = [];
  public isWrapped: boolean = false;

  constructor() {}
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
    console.log("create");

    console.dir(this);
  }
}
