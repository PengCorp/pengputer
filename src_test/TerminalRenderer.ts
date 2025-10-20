import type { Size } from "@src/types";
import cp437_9x16Url from "./cp437_9x16.png";
import cp437_9x16_megaUrl from "./cp437_9x16_mega.png";
import { loadTexture, createShader, createProgram } from "./util";
import vss from "./Character.vert?raw";
import fss from "./Character.frag?raw";
import type { ImageTexture } from "./types";
import tc from "tinycolor2";
import { charMap } from "./CharMap";
import { CgaColors } from "@Color/types";
import { CGA_PALETTE_DICT } from "@Color/cgaPalette";

// prettier-ignore
const quad = [
  -1.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0,

  1.0, -1.0,
  1.0, 1.0,
  -1.0, 1.0,
];

const aPositionLocation = 0;
const aOriginLocation = 1;
const aBackgroundColorLocation = 2;
const aForegroundColorLocation = 3;
const aAtlasPositionLocation = 4;
// decoration
// xxxx xxxx xxxx xxxx xxxx xxxx hbcc oooo
// oooo - outline (rlbt) (right left bottom top)
// cc - cursor style (no cursor, bottom, border, left), cursor blinks according to blinking timer
// b - is character blinking
// h - is half bright
const aDecorationLocation = 5;

const uniforms = [
  "u_gridSize",
  "u_characterSize",
  "u_atlas",
  "u_atlasSize",
] as const;
type Uniform = (typeof uniforms)[number];

interface TerminalRendererFont {
  characterSize: Size;
  texture: ImageTexture;
}

const colorCache: Record<string, tc.ColorFormats.RGBA> = {};

class TerminalCellBuffer {
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

export class TerminalRenderer {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;

  private vao!: WebGLVertexArrayObject;

  private quadBuffer!: WebGLBuffer;
  private originsBuffer!: WebGLBuffer;
  private foregroundColorsBuffer!: WebGLBuffer;
  private backgroundColorsBuffer!: WebGLBuffer;
  private atlasPositionBuffer!: WebGLBuffer;

  private charTex!: ImageTexture;

  private characterSize = [9, 16];

  private uniforms: Partial<Record<Uniform, WebGLUniformLocation>> = {};

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

  public async init() {
    const { gl } = this;

    const charTex = await loadTexture(gl, cp437_9x16_megaUrl);
    this.charTex = charTex;

    const vs = createShader(gl, gl.VERTEX_SHADER, vss);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fss);

    const program = createProgram(gl, [vs, fs], (gl, program) => {
      gl.bindAttribLocation(program, aPositionLocation, "a_position");
      gl.bindAttribLocation(program, aOriginLocation, "a_origin");
      gl.bindAttribLocation(
        program,
        aForegroundColorLocation,
        "a_foregroundColor",
      );
      gl.bindAttribLocation(
        program,
        aBackgroundColorLocation,
        "a_backgroundColor",
      );
      gl.bindAttribLocation(program, aAtlasPositionLocation, "a_atlasPosition");
    });
    this.program = program;

    for (const uniform of uniforms) {
      this.uniforms[uniform] = gl.getUniformLocation(program, uniform)!;
    }

    const vao = gl.createVertexArray();
    this.vao = vao;
    gl.bindVertexArray(vao);

    {
      // quad for vertex shader
      const quadData = new Float32Array(quad);
      const quadBuffer = gl.createBuffer();
      this.quadBuffer = quadBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPositionLocation);
      gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
    }

    {
      // screen origins
      const originsData = this.cellBuffer.getOriginsData();
      const originsBuffer = gl.createBuffer();
      this.originsBuffer = originsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, originsBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, originsData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aOriginLocation);
      gl.vertexAttribIPointer(aOriginLocation, 2, gl.UNSIGNED_INT, 0, 0);
      gl.vertexAttribDivisor(aOriginLocation, 1);
    }

    {
      // foregroundColors
      const foregroundColorsData = this.cellBuffer.getForegroundColorData();
      const foregroundColorsBuffer = gl.createBuffer();
      this.foregroundColorsBuffer = foregroundColorsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, foregroundColorsBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, foregroundColorsData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aForegroundColorLocation);
      gl.vertexAttribIPointer(
        aForegroundColorLocation,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(aForegroundColorLocation, 1);
    }

    {
      // backgroundColors
      const backgroundColorsData = this.cellBuffer.getBackgroundColorData();
      const backgroundColorsBuffer = gl.createBuffer();
      this.backgroundColorsBuffer = backgroundColorsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, backgroundColorsBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, backgroundColorsData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aBackgroundColorLocation);
      gl.vertexAttribIPointer(
        aBackgroundColorLocation,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(aBackgroundColorLocation, 1);
    }

    {
      // atlasPosition
      const atlasPositionData = this.cellBuffer.getAtlasPositionData();
      const atlasPositionBuffer = gl.createBuffer();
      this.atlasPositionBuffer = atlasPositionBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, atlasPositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, atlasPositionData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aAtlasPositionLocation);
      gl.vertexAttribIPointer(aAtlasPositionLocation, 2, gl.UNSIGNED_INT, 0, 0);
      gl.vertexAttribDivisor(aAtlasPositionLocation, 1);
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

    gl.useProgram(program);

    {
      // uniforms
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.charTex.texture);

      gl.uniform1i(this.uniforms["u_atlas"]!, 0);

      gl.uniform2ui(
        this.uniforms["u_atlasSize"]!,
        this.charTex.width,
        this.charTex.height,
      );

      const gridSize = this.cellBuffer.getSize();
      gl.uniform2ui(this.uniforms["u_gridSize"]!, gridSize.w, gridSize.h);

      gl.uniform2ui(
        this.uniforms["u_characterSize"]!,
        this.characterSize[0],
        this.characterSize[1],
      );
    }

    gl.bindVertexArray(vao);

    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      quad.length / 2, // (x, y)
      this.cellBuffer.getNumberOfCells(),
    );

    gl.bindVertexArray(null);

    gl.useProgram(null);
  }
}
