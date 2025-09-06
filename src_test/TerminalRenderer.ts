import type { Size } from "@src/types";
import cp437_9x16Url from "./cp437_9x16.png";
import { loadTexture, createShader, createProgram } from "./util";

// prettier-ignore
const quad = [
  -1.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0,

  1.0, -1.0,
  1.0, 1.0,
  -1.0, 1.0,
];

const vss = `#version 300 es
 
uniform uvec2 u_gridSize;
uniform uvec2 u_characterSize;

in vec2 a_position;

in uvec2 a_origin;
in uvec3 a_backgroundColor;
in uvec3 a_foregroundColor;

flat out uvec3 v_backgroundColor;
flat out uvec3 v_foregroundColor;
out vec2 v_positionInCell;

vec2 screenToClip(vec2 screen) {
  return vec2(
    screen.x * 2.0 - 1.0,
    1.0 - screen.y * 2.0
  );
}

vec2 clipToScreen(vec2 clip) {
  return vec2(
    (clip.x + 1.0) * 0.5,
    (1.0 - clip.y) * 0.5
  );
}
 
void main() {
  uvec2 resolution = u_gridSize * u_characterSize;
  vec2 pixelSize = 1.0 / vec2(resolution);
  vec2 cellSize = vec2(u_characterSize) * pixelSize;

  vec2 screenOrigin = vec2(a_origin) * cellSize;

  vec2 screenPosition = screenOrigin + clipToScreen(a_position) * cellSize;

  vec2 position = screenToClip(screenPosition);
  gl_Position = vec4(position.xy, 0.0, 1.0);

  v_backgroundColor = a_backgroundColor;
  v_foregroundColor = a_foregroundColor;
  v_positionInCell = clipToScreen(a_position);
}
`;

const fss = `#version 300 es

precision highp float;

uniform uvec2 u_gridSize;

flat in uvec3 v_backgroundColor;
flat in uvec3 v_foregroundColor;
in vec2 v_positionInCell;
 
out vec4 o_color;
 
void main() {
  vec3 fgColor = vec3(
    float(v_foregroundColor.r) / 255.0,
    float(v_foregroundColor.g) / 255.0,
    float(v_foregroundColor.b) / 255.0
  );
  vec3 bgColor = vec3(
    float(v_backgroundColor.r) / 255.0,
    float(v_backgroundColor.g) / 255.0,
    float(v_backgroundColor.b) / 255.0
  );
  o_color = mix(vec4(bgColor.rgb, 1.0), vec4(fgColor.rgb, 1.0), v_positionInCell.y);
}
`;

const aPositionLocation = 0;
const aOriginLocation = 1;
const aBackgroundColorLocation = 2;
const aForegroundColorLocation = 3;

const uniforms = ["u_gridSize", "u_characterSize"] as const;
type Uniform = (typeof uniforms)[number];

class TerminalCellBuffer {
  private originsData: Uint32Array;
  private foregroundColorData: Uint32Array;
  private backgroundColorData: Uint32Array;
  private gridSize: Size;

  public constructor() {
    this.originsData = new Uint32Array();
    this.foregroundColorData = new Uint32Array();
    this.backgroundColorData = new Uint32Array();
    this.gridSize = { w: 0, h: 0 };

    this.setSize({ w: 80, h: 25 });
  }

  public setSize(newGridSize: Size) {
    this.gridSize = newGridSize;

    const offsets = [];
    const backgroundColor = [];
    const foregroundColor = [];

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
      }
    }

    this.originsData = new Uint32Array(offsets);
    this.backgroundColorData = new Uint32Array(backgroundColor);
    this.foregroundColorData = new Uint32Array(foregroundColor);
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
}

export class TerminalRenderer {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;

  private vao!: WebGLVertexArrayObject;

  private quadBuffer!: WebGLBuffer;
  private originsBuffer!: WebGLBuffer;
  private foregroundColorsBuffer!: WebGLBuffer;
  private backgroundColorsBuffer!: WebGLBuffer;

  private charTex!: WebGLTexture;

  private characterSize = [9, 16];

  private uniforms: Partial<Record<Uniform, WebGLUniformLocation>> = {};

  private cellBuffer: TerminalCellBuffer;

  public constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    this.cellBuffer = new TerminalCellBuffer();
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
    });
    this.program = program;

    for (const uniform of uniforms) {
      this.uniforms[uniform] = gl.getUniformLocation(program, uniform)!;
    }

    const vao = gl.createVertexArray();
    this.vao = vao;
    gl.bindVertexArray(vao);

    {
      const quadData = new Float32Array(quad);
      const quadBuffer = gl.createBuffer();
      this.quadBuffer = quadBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPositionLocation);
      gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
    }

    {
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

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  public render() {
    const { gl, program, vao } = this;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    const gridSize = this.cellBuffer.getSize();
    gl.uniform2ui(this.uniforms["u_gridSize"]!, gridSize.w, gridSize.h);
    gl.uniform2ui(
      this.uniforms["u_characterSize"]!,
      this.characterSize[0],
      this.characterSize[1],
    );

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
