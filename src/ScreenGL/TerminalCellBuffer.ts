import type { Size } from "@src/types";
import tc from "tinycolor2";

const colorCache: Record<string, tc.ColorFormats.RGBA> = {};

export class TerminalCellBuffer {
  /** Positions of each cell in cell coordinates (default screen is 80x25 cells). */
  private originsData: Uint32Array;
  /** Foreground color of cell, triplets of (r, g, b). */
  private foregroundColorData: Uint32Array;
  /** Background color of cell, triplets of (r, g, b). */
  private backgroundColorData: Uint32Array;
  /** Atlas position from which to take character, in cell coordinates (1 cell is 1 character on atlas). */
  private atlasPositionData: Uint32Array;
  /** Attribute data. */
  private attributeData: Uint32Array;
  /** Array of runes at each respective cell. */
  private runeData: string[];

  private gridSize: Size;

  public constructor() {
    this.originsData = new Uint32Array();
    this.foregroundColorData = new Uint32Array();
    this.backgroundColorData = new Uint32Array();
    this.atlasPositionData = new Uint32Array();
    this.attributeData = new Uint32Array();

    this.gridSize = { w: 0, h: 0 };
    this.runeData = [];

    this.__setSize({ w: 80, h: 25 });
  }

  public __setSize(newGridSize: Size) {
    this.gridSize = newGridSize;

    const numCells = newGridSize.w * newGridSize.h;

    this.originsData = new Uint32Array(numCells * 2);
    this.backgroundColorData = new Uint32Array(numCells * 3);
    this.foregroundColorData = new Uint32Array(numCells * 3);
    this.atlasPositionData = new Uint32Array(numCells * 3);
    this.attributeData = new Uint32Array(numCells);
    this.runeData = new Array<string>(numCells).fill("\x00");

    for (let y = 0; y < newGridSize.h; y += 1) {
      for (let x = 0; x < newGridSize.w; x += 1) {
        const idx = y * newGridSize.w + x;
        this.originsData[idx * 2] = x;
        this.originsData[idx * 2 + 1] = y;
        this.foregroundColorData[idx * 3] = 255;
        this.foregroundColorData[idx * 3 + 1] = 255;
        this.foregroundColorData[idx * 3 + 2] = 255;
      }
    }
  }

  public getNumberOfCells() {
    return this.gridSize.w * this.gridSize.h;
  }

  public getSize(): Size {
    return { ...this.gridSize };
  }

  public getOriginsData() {
    return this.originsData;
  }

  public getForegroundColorData() {
    return this.foregroundColorData;
  }

  public getBackgroundColorData() {
    return this.backgroundColorData;
  }

  public getAtlasPositionData() {
    return this.atlasPositionData;
  }

  public getAttributeData() {
    return this.attributeData;
  }

  public getRuneAt(x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) {
      throw new Error("Getting character out of bounds.");
    }
    const idx = y * this.gridSize.w + x;
    return this.runeData[idx];
  }

  private _getRgb(color: string) {
    if (colorCache[color]) {
      return colorCache[color];
    }

    const rgb = tc(color).toRgb();
    colorCache[color] = rgb;
    return rgb;
  }

  public setForegroundColorAt(color: string, x: number, y: number) {
    const idx = (y * this.gridSize.w + x) * 3;
    const rgb = this._getRgb(color);
    this.foregroundColorData[idx] = rgb.r;
    this.foregroundColorData[idx + 1] = rgb.g;
    this.foregroundColorData[idx + 2] = rgb.b;
  }

  public setBackgroundColorAt(color: string, x: number, y: number) {
    const idx = (y * this.gridSize.w + x) * 3;
    const rgb = this._getRgb(color);
    this.backgroundColorData[idx] = rgb.r;
    this.backgroundColorData[idx + 1] = rgb.g;
    this.backgroundColorData[idx + 2] = rgb.b;
  }

  public setRuneAt(
    x: number,
    y: number,
    rune: string,
    atlasIdx: number,
    atlasX: number,
    atlasY: number,
  ) {
    const idx = y * this.gridSize.w + x;
    const idx3 = idx * 3;
    this.runeData[idx] = rune;
    this.atlasPositionData[idx3] = atlasX;
    this.atlasPositionData[idx3 + 1] = atlasY;
    this.atlasPositionData[idx3 + 2] = atlasIdx;
  }

  public setAttributesAt(attr: number, x: number, y: number) {
    this.attributeData[y * this.gridSize.w + x] = attr;
  }
}
