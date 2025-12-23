import type { Size } from "@src/types";
import { createShader, createProgram } from "./util";
import vss from "./Character.vert?raw";
import fss from "./Character.frag?raw";
import type { ImageTexture } from "./types";
import type { Font } from "./Font";

export interface CharacterTexture {
  texture: ImageTexture;
  characterSize: Size;
}

// prettier-ignore
const ndcQuad = [
  -1.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0,

  1.0, -1.0,
  1.0, 1.0,
  -1.0, 1.0,
];

export class CharacterProgram {
  private gl!: WebGL2RenderingContext;

  private program!: WebGLProgram;

  private vao!: WebGLVertexArrayObject;

  private quadBuffer!: WebGLBuffer;
  private originsBuffer!: WebGLBuffer;
  private atlasPositionBuffer!: WebGLBuffer;
  private foregroundColorBuffer!: WebGLBuffer;
  private backgroundColorBuffer!: WebGLBuffer;
  private attributeBuffer!: WebGLBuffer;

  private aPosition: number = -1;
  private aOrigin: number = -1;
  private aAtlasPosition: number = -1;
  private aForegroundColor: number = -1;
  private aBackgroundColor: number = -1;
  private aAttributes: number = -1;

  private uGridSize: WebGLUniformLocation | null = null;
  private uCharacterSize: WebGLUniformLocation | null = null;
  private uAtlas: WebGLUniformLocation | null = null;
  private uAttrAtlas: WebGLUniformLocation | null = null;
  private uAtlasSize: WebGLUniformLocation | null = null;

  private constructor() {}

  private createProgram() {
    const { gl } = this;

    const vs = createShader(gl, gl.VERTEX_SHADER, vss);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fss);

    const program = createProgram(gl, [vs, fs]);

    this.program = program;

    // uniform locations

    this.uGridSize = gl.getUniformLocation(program, "u_gridSize");
    this.uCharacterSize = gl.getUniformLocation(program, "u_characterSize");
    this.uAtlas = gl.getUniformLocation(program, "u_atlas");
    this.uAttrAtlas = gl.getUniformLocation(program, "u_attrAtlas");
    this.uAtlasSize = gl.getUniformLocation(program, "u_atlasSize");

    // attrib locations

    this.aPosition = gl.getAttribLocation(program, "a_position");
    this.aOrigin = gl.getAttribLocation(program, "a_origin");
    this.aAtlasPosition = gl.getAttribLocation(program, "a_atlasPosition");
    this.aForegroundColor = gl.getAttribLocation(program, "a_foregroundColor");
    this.aBackgroundColor = gl.getAttribLocation(program, "a_backgroundColor");
    this.aAttributes = gl.getAttribLocation(program, "a_attributes");
  }

  public static async create(gl: WebGL2RenderingContext) {
    const characterProgram = new CharacterProgram();
    characterProgram.gl = gl;

    characterProgram.createProgram();

    const vao = gl.createVertexArray();
    characterProgram.vao = vao;
    gl.bindVertexArray(vao);

    {
      // quad for vertex shader
      const quadBuffer = gl.createBuffer();
      characterProgram.quadBuffer = quadBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(characterProgram.aPosition);
      gl.vertexAttribPointer(
        characterProgram.aPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );

      const quadData = new Float32Array(ndcQuad);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    }

    {
      // screen origins
      const originsBuffer = gl.createBuffer();
      characterProgram.originsBuffer = originsBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, originsBuffer);
      gl.enableVertexAttribArray(characterProgram.aOrigin);
      gl.vertexAttribIPointer(
        characterProgram.aOrigin,
        2,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(characterProgram.aOrigin, 1);
    }

    {
      // atlasPosition
      const atlasPositionBuffer = gl.createBuffer();
      characterProgram.atlasPositionBuffer = atlasPositionBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, atlasPositionBuffer);
      gl.enableVertexAttribArray(characterProgram.aAtlasPosition);
      gl.vertexAttribIPointer(
        characterProgram.aAtlasPosition,
        2,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(characterProgram.aAtlasPosition, 1);
    }

    {
      // attributes
      const attributeBuffer = gl.createBuffer();
      characterProgram.attributeBuffer = attributeBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer);
      gl.enableVertexAttribArray(characterProgram.aAttributes);
      gl.vertexAttribIPointer(
        characterProgram.aAttributes,
        1,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(characterProgram.aAttributes, 1);
    }

    {
      // foreground color
      const foregroundColorBuffer = gl.createBuffer();
      characterProgram.foregroundColorBuffer = foregroundColorBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, foregroundColorBuffer);
      gl.enableVertexAttribArray(characterProgram.aForegroundColor);
      gl.vertexAttribIPointer(
        characterProgram.aForegroundColor,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(characterProgram.aForegroundColor, 1);
    }

    {
      // background color
      const backgroundColorBuffer = gl.createBuffer();
      characterProgram.backgroundColorBuffer = backgroundColorBuffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, backgroundColorBuffer);
      gl.enableVertexAttribArray(characterProgram.aBackgroundColor);
      gl.vertexAttribIPointer(
        characterProgram.aBackgroundColor,
        3,
        gl.UNSIGNED_INT,
        0,
        0,
      );
      gl.vertexAttribDivisor(characterProgram.aBackgroundColor, 1);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    return characterProgram;
  }

  public render({
    originsData,
    atlasPositionData,
    foregroundColorData,
    backgroundColorData,
    attributeData,
    numberOfCells,
    gridSize,
    font,
  }: {
    originsData: Uint32Array;
    atlasPositionData: Uint32Array;
    foregroundColorData: Uint32Array;
    backgroundColorData: Uint32Array;
    attributeData: Uint32Array;
    numberOfCells: number;
    gridSize: Size;
    font: Font;
  }) {
    const { gl, program, vao } = this;

    {
      // update buffers

      const targets = [
        [this.originsBuffer, originsData],
        [this.atlasPositionBuffer, atlasPositionData],
        [this.foregroundColorBuffer, foregroundColorData],
        [this.backgroundColorBuffer, backgroundColorData],
        [this.attributeBuffer, attributeData],
      ] as const;

      for (const target of targets) {
        gl.bindBuffer(gl.ARRAY_BUFFER, target[0]);
        gl.bufferData(gl.ARRAY_BUFFER, target[1], gl.STATIC_DRAW);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    gl.useProgram(program);

    {
      // set uniforms
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, font.texture.texture);
      gl.uniform1i(this.uAtlas, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, font.attrTexture.texture);
      gl.uniform1i(this.uAttrAtlas, 1);

      gl.uniform2ui(this.uAtlasSize, font.texture.width, font.texture.height);

      gl.uniform2ui(this.uGridSize, gridSize.w, gridSize.h);

      gl.uniform2ui(this.uCharacterSize, font.charSize.w, font.charSize.h);
    }

    // draw characters

    gl.bindVertexArray(vao);

    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      ndcQuad.length / 2, // (x, y)
      numberOfCells,
    );

    gl.bindVertexArray(null);

    gl.useProgram(null);
  }
}
