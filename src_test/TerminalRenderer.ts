import type { Size } from "@src/types";
import cp437_9x16Url from "./cp437_9x16.png";
import { loadTexture, createShader, createProgram } from "./util";
import vss from "./Character.vert?raw";
import fss from "./Character.frag?raw";
import type { ImageTexture } from "./types";

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

class TerminalCellBuffer {
  private originsData: Uint32Array;
  private foregroundColorData: Uint32Array;
  private backgroundColorData: Uint32Array;
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

    const offsets = [];
    const backgroundColor = [];
    const foregroundColor = [];
    const atlasPosition = [];

    for (let y = 0; y < this.gridSize.h; y += 1) {
      for (let x = 0; x < this.gridSize.w; x += 1) {
        offsets.push(x, y);
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
        atlasPosition.push(x % 32, y % 8);
      }
    }

    this.originsData = new Uint32Array(offsets);
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

  public setSize(size: Size) {
    this.cellBuffer.__setSize(size);
    this.updateFromCellBuffer(true);
  }

  public async init() {
    const { gl } = this;

    const charTex = await loadTexture(gl, cp437_9x16Url);
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

    this.updateFromCellBuffer(true);
  }

  public updateFromCellBuffer(replace: boolean) {
    const { gl } = this;

    const targets = [
      [this.originsBuffer, this.cellBuffer.getOriginsData()],
      [this.backgroundColorsBuffer, this.cellBuffer.getBackgroundColorData()],
      [this.foregroundColorsBuffer, this.cellBuffer.getForegroundColorData()],
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
      quad.length / 2,
      this.cellBuffer.getNumberOfCells(),
    );

    gl.bindVertexArray(null);

    gl.useProgram(null);
  }
}
