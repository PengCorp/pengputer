import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { createProgram, createShader } from "./Screen.glut";

const vs = `#version 300 es
in vec4 a_position;

void main() {
  gl_Position = a_position;
}
`;

const fs = `#version 300 es
precision highp float;

in vec2 v_texcoord;

//uniform sampler2D u_texture;
uniform vec2 u_resolution;

out vec4 outColor;
uniform vec2 u_chars_grid_size;

void main() {
  vec2 screen_coord = gl_FragCoord.xy * vec2(1.0, -1.0) + vec2(0.0, u_resolution.y);

  vec2 char_size = u_resolution / u_chars_grid_size;

  vec2 grid_pos = floor(screen_coord.xy / char_size);

  vec2 cell_color = grid_pos.xy / u_chars_grid_size.xy;

  outColor = vec4(cell_color.xy,mod(grid_pos.x, 2.0),1);
}
`;

let program: WebGLProgram;

let positionAttributeLocation: number;
let resolutionUniformLocation: WebGLUniformLocation;
let charsGridSizeUniformLocation: WebGLUniformLocation;

let vao: WebGLVertexArrayObject;

export const initScreen = (gl: WebGL2RenderingContext) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs)!;
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs)!;

  program = createProgram(gl, vertexShader, fragmentShader)!;

  positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution")!;
  charsGridSizeUniformLocation = gl.getUniformLocation(
    program,
    "u_chars_grid_size",
  )!;

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // prettier-ignore
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, 1,
      1, 1,
      -1, -1,
      
      1, 1,
      1, -1,
      -1, -1
    ]),
    gl.STATIC_DRAW,
  );

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.enableVertexAttribArray(positionAttributeLocation);

  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
};

export const drawScreen = (gl: WebGL2RenderingContext) => {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0, 0, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
  gl.uniform2f(charsGridSizeUniformLocation, 80, 25);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
};
