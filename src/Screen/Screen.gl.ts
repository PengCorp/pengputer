import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { createProgram, createShader } from "./Screen.glut";

const vs = `#version 300 es
 
// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;

uniform vec2 u_resolution;
 
// all shaders have a main function
void main() {
  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = vec4((a_position / u_resolution * 2.0 - 1.0) * vec2(1, -1), 0, 1);
}`;

const fs = `#version 300 es
 
// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

uniform vec4 u_color;
 
// we need to declare an output for the fragment shader
out vec4 outColor;
 
void main() {
  // Just set the output to a constant reddish-purple
  outColor = u_color;
}`;

// Returns a random integer from 0 to range - 1.
function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

function setRectangle(
  gl: WebGL2RenderingContext,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;

  // NOTE: gl.bufferData(gl.ARRAY_BUFFER, ...) will affect
  // whatever buffer is bound to the `ARRAY_BUFFER` bind point
  // but so far we only have one buffer. If we had more than one
  // buffer we'd want to bind that buffer to `ARRAY_BUFFER` first.

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
    gl.STATIC_DRAW,
  );
}

let program: WebGLProgram;

let positionAttributeLocation: number;
let resolutionUniformLocation: WebGLUniformLocation;
let colorUniformLocation: WebGLUniformLocation;

let vao: WebGLVertexArrayObject;

export const initScreen = (gl: WebGL2RenderingContext) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs)!;
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs)!;

  program = createProgram(gl, vertexShader, fragmentShader)!;

  positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution")!;
  colorUniformLocation = gl.getUniformLocation(program, "u_color")!;

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionAttributeLocation);
};

export const drawScreen = (gl: WebGL2RenderingContext) => {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0, 0, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  for (var ii = 0; ii < 50; ++ii) {
    setRectangle(
      gl,
      randomInt(300),
      randomInt(300),
      randomInt(300),
      randomInt(300),
    );

    gl.uniform4f(
      colorUniformLocation,
      Math.random(),
      Math.random(),
      Math.random(),
      1,
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
};
