import { CharacterProgram } from "./CharacterProgram";
import { CgaColors } from "@Color/types";
import { CGA_PALETTE_DICT } from "@Color/cgaPalette";
import { TerminalCellBuffer } from "./TerminalCellBuffer";
import { loadFont9x16 } from "./Font9x16";

export class TerminalRenderer {
  private gl!: WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;

  private characterProgram!: CharacterProgram;

  private cellBuffer!: TerminalCellBuffer;

  private constructor() {}

  public static async create(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ) {
    const renderer = new TerminalRenderer();

    renderer.canvas = canvas;
    renderer.gl = gl;

    renderer.cellBuffer = new TerminalCellBuffer();

    renderer.characterProgram = await CharacterProgram.create(gl);
    renderer.cellBuffer.setFont(await loadFont9x16(renderer.gl));

    return renderer;
  }

  public render() {
    const { gl, cellBuffer } = this;

    gl.disable(gl.DEPTH_TEST);

    cellBuffer.setForegroundColorAt(CGA_PALETTE_DICT[CgaColors.Blue], 0, 0);
    cellBuffer.setBackgroundColorAt(CGA_PALETTE_DICT[CgaColors.Green], 0, 0);
    cellBuffer.setCharacterAt("W", 40, 10);
    cellBuffer.setAttributesAt(0b0000_0000_0111_0000, 40, 10);

    const width = gl.canvas.width;
    const height = gl.canvas.height;

    gl.viewport(0, 0, width, height);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.characterProgram.render({
      originsData: this.cellBuffer.getOriginsData(),
      atlasPositionData: this.cellBuffer.getAtlasPositionData(),
      foregroundColorData: this.cellBuffer.getForegroundColorData(),
      backgroundColorData: this.cellBuffer.getBackgroundColorData(),
      attributeData: this.cellBuffer.getAttributeData(),
      numberOfCells: this.cellBuffer.getNumberOfCells(),
      gridSize: this.cellBuffer.getSize(),
      font: this.cellBuffer.getFont(),
    });
  }
}
