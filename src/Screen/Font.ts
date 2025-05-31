import { dataURLToImageBitmap } from "../util";

export class Font {
  public characterWidth: number;
  public characterHeight: number;

  private atlases: Record<any, any>;

  constructor(characterWidth: number, characterHeight: number) {
    this.characterWidth = characterWidth;
    this.characterHeight = characterHeight;

    this.atlases = {};
  }

  async loadAtlas(
    key: string,
    dataURL: string,
    valueMap: Array<Array<string> | string>
  ) {
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

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r === 0 && g === 0 && b === 0) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

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
