import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { createProgram, loadShader } from "./Screen.utils";

const vShaderStr = `#version 300 es

in vec4 a_position;

out vec2 v_screenPosition;

void main() {
  v_screenPosition = (a_position.xy * 0.5 + 0.5) * vec2(1, -1) + vec2(0, 1);
  gl_Position = a_position;
}
`;

const fShaderStr = `#version 300 es
precision highp float;

in vec2 v_screenPosition;

out vec4 o_fragColor;

void main() {
  o_fragColor = vec4(v_screenPosition.x, v_screenPosition.y, 0.0, 1.0);
}
`;

let program: WebGLProgram;

let vao: WebGLVertexArrayObject;
let vbo: WebGLBuffer;

let positionAttributeLocation: number;
let resolutionUniformLocation: WebGLUniformLocation;
let charsGridSizeUniformLocation: WebGLUniformLocation;

// prettier-ignore
const quad = new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]);

export const initScreen = (gl: WebGL2RenderingContext) => {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vShaderStr)!;
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fShaderStr)!;

  program = createProgram(gl, vertexShader, fragmentShader)!;
  gl.useProgram(program);

  positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindVertexArray(null);
};

export const drawScreen = (gl: WebGL2RenderingContext) => {
  gl.clearColor(0.0, 0.0, 0.25, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindVertexArray(null);
};
