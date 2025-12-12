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

    // previous + current = next

    gl.disable(gl.DEPTH_TEST);

    {
      // demo update to set a gray W at 0,0
      cellBuffer.setBackgroundColorAt(CGA_PALETTE_DICT[CgaColors.Black], 0, 0);
      cellBuffer.setForegroundColorAt(
        CGA_PALETTE_DICT[CgaColors.LightGray],
        0,
        0,
      );
      cellBuffer.setCharacterAt("W", 0, 0);
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.characterProgram.render({
      originsData: this.cellBuffer.getOriginsData(),
      atlasPositionData: this.cellBuffer.getAtlasPositionData(),
      numberOfCells: this.cellBuffer.getNumberOfCells(),
      gridSize: this.cellBuffer.getSize(),
      font: this.cellBuffer.getFont(),
    });

    this.characterProgram.render({
      originsData: Uint32Array.from([0, 1]),
      atlasPositionData: Uint32Array.from([3, 1]),
      numberOfCells: 1,
      gridSize: this.cellBuffer.getSize(),
      font: this.cellBuffer.getFont(),
    });
  }
}
