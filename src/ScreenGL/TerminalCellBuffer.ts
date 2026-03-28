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

    const origins = [];
    const backgroundColor = [];
    const foregroundColor = [];
    const atlasPosition = [];
    const attributes = [];
    const runes: string[] = [];

    for (let y = 0; y < this.gridSize.h; y += 1) {
      for (let x = 0; x < this.gridSize.w; x += 1) {
        origins.push(x, y);
        backgroundColor.push(
          (y / this.gridSize.h) * 255,
          (x / this.gridSize.w) * 255,
          0,
        );
        foregroundColor.push(
          0,
          (y / this.gridSize.h) * 255,
          (x / this.gridSize.w) * 255,
        );
        atlasPosition.push(0, 0, 0);
        attributes.push(0);
        runes.push("\x00");
      }
    }

    this.originsData = new Uint32Array(origins);
    this.backgroundColorData = new Uint32Array(backgroundColor);
    this.foregroundColorData = new Uint32Array(foregroundColor);
    this.atlasPositionData = new Uint32Array(atlasPosition);
    this.attributeData = new Uint32Array(attributes);
    this.runeData = runes;
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
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) {
      throw new Error("Setting foreground color out of bounds.");
    }

    const idx = (y * this.gridSize.w + x) * 3;
    let rgb = this._getRgb(color);
    this.foregroundColorData[idx + 0] = rgb.r;
    this.foregroundColorData[idx + 1] = rgb.g;
    this.foregroundColorData[idx + 2] = rgb.b;
  }

  public setBackgroundColorAt(color: string, x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) {
      throw new Error("Setting background color out of bounds.");
    }

    const idx = (y * this.gridSize.w + x) * 3;
    let rgb = this._getRgb(color);
    this.backgroundColorData[idx + 0] = rgb.r;
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
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) {
      throw new Error("Setting character out of bounds.");
    }

    const idx = y * this.gridSize.w + x;
    const idx3 = idx * 3;
    this.runeData[idx] = rune;
    this.atlasPositionData[idx3 + 0] = atlasX;
    this.atlasPositionData[idx3 + 1] = atlasY;
    this.atlasPositionData[idx3 + 2] = atlasIdx;
  }

  public setAttributesAt(attr: number, x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) {
      throw new Error("Setting attributes out of bounds.");
    }

    const idx = y * this.gridSize.w + x;
    this.attributeData[idx] = attr;
  }
}
