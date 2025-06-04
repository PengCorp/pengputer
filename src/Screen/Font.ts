import { StringLike } from "../types";
import { dataURLToImageBitmap } from "../util";

/** Represents a font that contains character glyphs. Single font can contain multiple atlases with character maps. */
export class Font {
  private characterWidth: number;
  private characterHeight: number;

  private atlases: Record<any, any>;

  constructor(characterWidth: number, characterHeight: number) {
    this.characterWidth = characterWidth;
    this.characterHeight = characterHeight;

    this.atlases = {};
  }

  /**
   * Loads a character atlas from a data URL.
   * @param key - The key to identify the atlas.
   * @param dataURL - The data URL of the image containing the character atlas, characters are white, background is transparent.
   * @param valueMap - A 2D array or array of strings that maps characters to their positions in the atlas. The array should be the same size as the atlas image, where each element corresponds to a character in the atlas.
   * @returns A promise that resolves when the atlas is loaded.
   */
  async loadAtlas(key: string, dataURL: string, valueMap: Array<StringLike>) {
    this.atlases[key] = {};
    const atlas = this.atlases[key];

    // load image

    const bitmap = await dataURLToImageBitmap(dataURL);

    const canvas = document.createElement("canvas");
    atlas.canvas = canvas;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    atlas.ctx = ctx;

    if (!ctx) {
      throw new Error("Failed to initialize 2d context.");
    }

    ctx.drawImage(bitmap, 0, 0);

    // load valueMap

    atlas.characterLocations = {};
    for (let y = 0; y < valueMap.length; y += 1) {
      for (let x = 0; x < valueMap[y].length; x += 1) {
        atlas.characterLocations[valueMap[y][x]] = {
          x: x * this.characterWidth,
          y: y * this.characterHeight,
        };
      }
    }
  }

  /** Retrieves a descriptor of the character with the atlas, x, y, w, and h of the character. */
  getCharacter(char: string) {
    for (let atlasKey in this.atlases) {
      const atlas = this.atlases[atlasKey];

      const characterLocation = atlas.characterLocations[char];
      if (characterLocation) {
        return {
          canvas: atlas.canvas,
          x: characterLocation.x,
          y: characterLocation.y,
          w: this.characterWidth,
          h: this.characterHeight,
        };
      }
    }
  }
}
