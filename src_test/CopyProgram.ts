import { createShader, createProgram } from "./util";
import type { ImageTexture } from "./types";

// prettier-ignore
const ndcQuad = new Float32Array([
  -1.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0,

  1.0, -1.0,
  1.0, 1.0,
  -1.0, 1.0,
]);

const vertexSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv);
}
`;

export class CopyProgram {
  private gl!: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private quadBuffer!: WebGLBuffer;

  private aPosition: number = -1;
  private uTexture: WebGLUniformLocation | null = null;

  private constructor() {}

  private createProgram() {
    const { gl } = this;

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = createProgram(gl, [vs, fs]);
    this.program = program;

    this.aPosition = gl.getAttribLocation(program, "a_position");
    this.uTexture = gl.getUniformLocation(program, "u_texture");
  }

  public static async create(gl: WebGL2RenderingContext) {
    const copyProgram = new CopyProgram();

    copyProgram.gl = gl;
    copyProgram.createProgram();

    copyProgram.vao = gl.createVertexArray();
    gl.bindVertexArray(copyProgram.vao);

    copyProgram.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, copyProgram.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ndcQuad, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(copyProgram.aPosition);
    gl.vertexAttribPointer(copyProgram.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    return copyProgram;
  }

  public draw(texture: WebGLTexture) {
    const { gl, program, vao } = this;

    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uTexture, 0);

    gl.bindVertexArray(vao);

    gl.drawArrays(gl.TRIANGLES, 0, ndcQuad.length / 2);

    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
