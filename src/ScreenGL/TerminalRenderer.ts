import { CharacterProgram } from "./CharacterProgram";
import { TerminalCellBuffer } from "./TerminalCellBuffer";
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
