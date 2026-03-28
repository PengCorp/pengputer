import { CharacterProgram } from "./CharacterProgram";
import { CgaColors } from "@Color/types";
import { CGA_PALETTE_DICT } from "@Color/cgaPalette";
import { TerminalCellBuffer } from "./TerminalCellBuffer";
import { loadFont9x16 } from "./Font9x16";
import type { Font } from "./Font";

export class TerminalRenderer {
  private gl!: WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;

  private characterProgram!: CharacterProgram;

  private constructor() {}

  public static async create(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ) {
    const renderer = new TerminalRenderer();

    renderer.canvas = canvas;
    renderer.gl = gl;

    renderer.characterProgram = await CharacterProgram.create(gl);

    return renderer;
  }

  public render(cellBuffer: TerminalCellBuffer, font: Font) {
    const { gl } = this;

    gl.disable(gl.DEPTH_TEST);

    cellBuffer.setForegroundColorAt(CGA_PALETTE_DICT[CgaColors.Blue], 0, 0);
    cellBuffer.setBackgroundColorAt(CGA_PALETTE_DICT[CgaColors.Green], 0, 0);
    {
      const { x, y } = font.charMap["W"];
      cellBuffer.setRuneAt(40, 10, "W", 0, x, y);
    }
    cellBuffer.setAttributesAt(0b0000_0000_0111_0000, 40, 10);

    const width = gl.canvas.width;
    const height = gl.canvas.height;

    gl.viewport(0, 0, width, height);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.characterProgram.render({
      originsData: cellBuffer.getOriginsData(),
      atlasPositionData: cellBuffer.getAtlasPositionData(),
      foregroundColorData: cellBuffer.getForegroundColorData(),
      backgroundColorData: cellBuffer.getBackgroundColorData(),
      attributeData: cellBuffer.getAttributeData(),
      numberOfCells: cellBuffer.getNumberOfCells(),
      gridSize: cellBuffer.getSize(),
      font: font,
    });
  }
}
