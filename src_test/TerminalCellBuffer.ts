import type { Size } from "@src/types";
import tc from "tinycolor2";
import { charMap } from "./CharMap";

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

  private gridSize: Size;

  public constructor() {
    this.originsData = new Uint32Array();
    this.foregroundColorData = new Uint32Array();
    this.backgroundColorData = new Uint32Array();
    this.atlasPositionData = new Uint32Array();
    this.gridSize = { w: 0, h: 0 };

    this.__setSize({ w: 80, h: 25 });
  }

  public __setSize(newGridSize: Size) {
    this.gridSize = newGridSize;

    const origins = [];
    const backgroundColor = [];
    const foregroundColor = [];
    const atlasPosition = [];

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
        atlasPosition.push(x % 32, y % 24);
      }
    }

    this.originsData = new Uint32Array(origins);
    this.backgroundColorData = new Uint32Array(backgroundColor);
    this.foregroundColorData = new Uint32Array(foregroundColor);
    this.atlasPositionData = new Uint32Array(atlasPosition);
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

  private _getRgb(color: string) {
    if (colorCache[color]) {
      return colorCache[color];
    }
    const rgb = tc(color).toRgb();
    colorCache[color] = rgb;
    return rgb;
  }

  public setForegroundColorAt(color: string, x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) return;
    const idx = (y * this.gridSize.w + x) * 3;
    let rgb = this._getRgb(color);
    this.foregroundColorData[idx + 0] = rgb.r;
    this.foregroundColorData[idx + 1] = rgb.g;
    this.foregroundColorData[idx + 2] = rgb.b;
  }

  public setBackgroundColorAt(color: string, x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) return;
    const idx = (y * this.gridSize.w + x) * 3;
    let rgb = this._getRgb(color);
    this.backgroundColorData[idx + 0] = rgb.r;
    this.backgroundColorData[idx + 1] = rgb.g;
    this.backgroundColorData[idx + 2] = rgb.b;
  }

  public setCharacterAt(char: string, x: number, y: number) {
    if (x < 0 || x >= this.gridSize.w || y < 0 || y >= this.gridSize.h) return;
    const idx = (y * this.gridSize.w + x) * 2;
    const position = charMap[char];
    if (position) {
      const { x, y } = position;
      this.atlasPositionData[idx + 0] = x;
      this.atlasPositionData[idx + 1] = y;
    }
  }
}
