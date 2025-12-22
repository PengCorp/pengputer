import type { Coord, Size } from "@src/types";
import type { ImageTexture } from "./types";
import { loadTexture } from "./util";

export class Font {
  private constructor() {}

  public texture!: ImageTexture;
  public attrTexture!: ImageTexture;
  public charMap!: Record<string, Coord>;
  public charSize!: Size;

  static async load(
    gl: WebGL2RenderingContext,
    atlasUrl: string,
    attrUrl: string,
    charMap: Record<string, Coord>,
    charSize: Size,
  ) {
    const font = new Font();

    font.texture = await loadTexture(gl, atlasUrl);
    font.attrTexture = await loadTexture(gl, attrUrl);
    font.charMap = charMap;
    font.charSize = charSize;

    return font;
  }
}
