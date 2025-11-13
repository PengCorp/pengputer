import type { Size } from "@src/types";
import cp437_9x16Url from "./cp437_9x16.png";
import cp437_9x16_megaUrl from "./cp437_9x16_mega.png";
import { loadTexture, createShader, createProgram } from "./util";
import vss from "./Character.vert?raw";
import fss from "./Character.frag?raw";
import type { ImageTexture } from "./types";
import { CgaColors } from "@Color/types";
import { CGA_PALETTE_DICT } from "@Color/cgaPalette";
import { TerminalCellBuffer } from "./TerminalCellBuffer";

// prettier-ignore
const ndcQuad = [
  -1.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0,

  1.0, -1.0,
  1.0, 1.0,
  -1.0, 1.0,
];

export class TerminalRenderer {
  private gl: WebGL2RenderingContext;

  private program!: WebGLProgram;

  private vao!: WebGLVertexArrayObject;

  private quadBuffer!: WebGLBuffer;
  private originsBuffer!: WebGLBuffer;
  private foregroundColorsBuffer!: WebGLBuffer;
  private backgroundColorsBuffer!: WebGLBuffer;
  private atlasPositionBuffer!: WebGLBuffer;

  private resultTexture!: WebGLTexture;
  private workTexture!: WebGLTexture;
  private workFramebuffer!: WebGLFramebuffer;

  private charTex!: ImageTexture;

  private characterSize = [9, 16];

  private aPositionLocation: number = -1;
  private aOriginLocation: number = -1;
  private aBackgroundColorLocation: number = -1;
  private aForegroundColorLocation: number = -1;
  private aAtlasPositionLocation: number = -1;

  private uGridSizeLocation: WebGLUniformLocation | null = null;
  private uCharacterSizeLocation: WebGLUniformLocation | null = null;
  private uAtlasLocation: WebGLUniformLocation | null = null;
  private uAtlasSizeLocation: WebGLUniformLocation | null = null;
  private uModeLocation: WebGLUniformLocation | null = null;

  private cellBuffer: TerminalCellBuffer;

  public constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    this.cellBuffer = new TerminalCellBuffer();
  }

  public getCellBuffer() {
    return this.cellBuffer;
  }

  public setBufferSize(size: Size) {
    this.cellBuffer.__setSize(size);
    this.updateFromCellBuffer(true);
  }

  public setCharacterSize(size: Size) {
    this.characterSize = [size.w, size.h];
  }

  private createProgram() {
    const { gl } = this;

    const vs = createShader(gl, gl.VERTEX_SHADER, vss);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fss);

    const program = createProgram(gl, [vs, fs]);

    this.program = program;

    // uniform locations

    this.uGridSizeLocation = gl.getUniformLocation(program, "u_gridSize");
    this.uCharacterSizeLocation = gl.getUniformLocation(
      program,
      "u_characterSize",
    );
    this.uAtlasLocation = gl.getUniformLocation(program, "u_atlas");
    this.uAtlasSizeLocation = gl.getUniformLocation(program, "u_atlasSize");
    this.uModeLocation = gl.getUniformLocation(program, "u_mode");

    // attrib locations

    this.aPositionLocation = gl.getAttribLocation(program, "a_position");
    this.aOriginLocation = gl.getAttribLocation(program, "a_origin");
    this.aForegroundColorLocation = gl.getAttribLocation(
      program,
      "a_foregroundColor",
    );
    this.aBackgroundColorLocation = gl.getAttribLocation(
      program,
      "a_backgroundColor",
    );
    this.aAtlasPositionLocation = gl.getAttribLocation(
      program,
      "a_atlasPosition",
    );
  }

  public async init() {
    const { gl } = this;

    this.resultTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.workTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.workTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.workFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.workFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.workTexture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const charTex = await loadTexture(gl, cp437_9x16_megaUrl);
    this.charTex = charTex;

    this.createProgram();

    const vao = gl.createVertexArray();
    this.vao = vao;
    gl.bindVertexArray(vao);

    {
      // quad for vertex shader
      const quadBuffer = gl.createBuffer();
      this.quadBuffer = quadBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(this.aPositionLocation);
      gl.vertexAttribPointer(this.aPositionLocation, 2, gl.FLOAT, false, 0, 0);

      const quadData = new Float32Array(ndcQuad);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    }

    {
      // screen origins
      const originsBuffer = gl.createBuffer();
      this.originsBuffer = originsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, originsBuffer);
      gl.enableVertexAttribArray(this.aOriginLocation);
      gl.vertexAttribIPointer(this.aOriginLocation, 2, gl.UNSIGNED_INT, 0, 0);
      gl.vertexAttribDivisor(this.aOriginLocation, 1);

      const originsData = this.cellBuffer.getOriginsData();
      gl.bufferData(gl.ARRAY_BUFFER, originsData, gl.STATIC_DRAW);
    }

    {
      // foregroundColors
      const foregroundColorsBuffer = gl.createBuffer();
      this.foregroundColorsBuffer = foregroundColorsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, foregroundColorsBuffer);
      gl.enableVertexAttribArray(this.aForegroundColorLocation);
      gl.vertexAttribIPointer(
        this.aForegroundColorLocation,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(this.aForegroundColorLocation, 1);

      const foregroundColorsData = this.cellBuffer.getForegroundColorData();
      gl.bufferData(gl.ARRAY_BUFFER, foregroundColorsData, gl.STATIC_DRAW);
    }

    {
      // backgroundColors
      const backgroundColorsBuffer = gl.createBuffer();
      this.backgroundColorsBuffer = backgroundColorsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, backgroundColorsBuffer);
      gl.enableVertexAttribArray(this.aBackgroundColorLocation);
      gl.vertexAttribIPointer(
        this.aBackgroundColorLocation,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(this.aBackgroundColorLocation, 1);

      const backgroundColorsData = this.cellBuffer.getBackgroundColorData();
      gl.bufferData(gl.ARRAY_BUFFER, backgroundColorsData, gl.STATIC_DRAW);
    }

    {
      // atlasPosition
      const atlasPositionBuffer = gl.createBuffer();
      this.atlasPositionBuffer = atlasPositionBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, atlasPositionBuffer);
      gl.enableVertexAttribArray(this.aAtlasPositionLocation);
      gl.vertexAttribIPointer(
        this.aAtlasPositionLocation,
        2,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(this.aAtlasPositionLocation, 1);

      const atlasPositionData = this.cellBuffer.getAtlasPositionData();
      gl.bufferData(gl.ARRAY_BUFFER, atlasPositionData, gl.STATIC_DRAW);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    this.cellBuffer.setBackgroundColorAt(
      CGA_PALETTE_DICT[CgaColors.Black],
      0,
      0,
    );
    this.cellBuffer.setForegroundColorAt(
      CGA_PALETTE_DICT[CgaColors.LightGray],
      0,
      0,
    );
    this.cellBuffer.setCharacterAt("W", 0, 0);

    this.updateFromCellBuffer(true);
  }

  /**
   * @param replace should data buffers be replaced completely or just updated. Use replace when size of buffers changes.
   */
  public updateFromCellBuffer(replace: boolean) {
    const { gl } = this;

    const targets = [
      [this.originsBuffer, this.cellBuffer.getOriginsData()],
      [this.backgroundColorsBuffer, this.cellBuffer.getBackgroundColorData()],
      [this.foregroundColorsBuffer, this.cellBuffer.getForegroundColorData()],
      [this.atlasPositionBuffer, this.cellBuffer.getAtlasPositionData()],
    ] as const;

    for (const target of targets) {
      gl.bindBuffer(gl.ARRAY_BUFFER, target[0]);
      if (replace) {
        gl.bufferData(gl.ARRAY_BUFFER, target[1], gl.STATIC_DRAW);
      } else {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, target[1]);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  public render() {
    const { gl, program, vao } = this;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    {
      // set uniforms
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.charTex.texture);
      gl.uniform1i(this.uAtlasLocation, 0);

      gl.uniform2ui(
        this.uAtlasSizeLocation,
        this.charTex.width,
        this.charTex.height,
      );

      const gridSize = this.cellBuffer.getSize();
      gl.uniform2ui(this.uGridSizeLocation, gridSize.w, gridSize.h);

      gl.uniform2ui(
        this.uCharacterSizeLocation,
        this.characterSize[0],
        this.characterSize[1],
      );
    }

    // draw characters

    gl.uniform1ui(this.uModeLocation, 1);

    gl.bindVertexArray(vao);

    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      ndcQuad.length / 2, // (x, y)
      this.cellBuffer.getNumberOfCells(),
    );

    gl.bindVertexArray(null);

    gl.useProgram(null);
  }
}
