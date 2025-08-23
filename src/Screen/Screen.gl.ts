import { dataURLToImageBitmap } from "@src/util";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import {
  createProgram,
  createTextureFromImageBitmap,
  loadShader,
} from "./Screen.utils";
import cp437 from "./cp437_9x16.png";

const vShaderStr = `#version 300 es

in vec4 a_position;

out vec2 v_screenPosition;

void main() {
  v_screenPosition = a_position.xy * 0.5 + 0.5;
  v_screenPosition.y = 1.0 - v_screenPosition.y;
  
  gl_Position = a_position;
}
`;

const fShaderStr = `#version 300 es
precision highp float;

const float epsilon = 0.00001;

uniform ivec2 u_gridResolution;
uniform sampler2D u_texture;
uniform ivec2 u_textureSize;

in vec2 v_screenPosition;

out vec4 o_fragColor;

void main() {
  ivec2 textureGridPosition = ivec2(2, 2);
  ivec2 characterPixelSize = ivec2(9, 16);

  vec2 texelSize = 1.0 / vec2(u_textureSize);
  vec2 tileSize = vec2(characterPixelSize) * texelSize;

  vec2 textureOrigin = vec2(textureGridPosition * characterPixelSize) * texelSize;

  vec2 screenGridPos = max(vec2(0.0, 0.0), v_screenPosition - epsilon) * vec2(u_gridResolution);
  vec2 cellPos = fract(screenGridPos);

  vec2 texturePosition = textureOrigin + cellPos * tileSize;

  texturePosition += epsilon * texelSize;

  o_fragColor = texture(
    u_texture,
    texturePosition
  );
}
`;

let program: WebGLProgram;

let vao: WebGLVertexArrayObject;
let vbo: WebGLBuffer;

let positionAttributeLocation: number;
let gridResolutionUniformLocation: WebGLUniformLocation;
let textureUniformLocation: WebGLUniformLocation;
let textureSizeUniformLocation: WebGLUniformLocation;

// prettier-ignore
const quad = new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]);

let fontTexture: ReturnType<typeof createTextureFromImageBitmap>;

export const initScreen = async (gl: WebGL2RenderingContext) => {
  fontTexture = createTextureFromImageBitmap(
    gl,
    await dataURLToImageBitmap(cp437),
  );

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vShaderStr)!;
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fShaderStr)!;

  program = createProgram(gl, vertexShader, fragmentShader)!;
  gl.useProgram(program);

  positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  gridResolutionUniformLocation = gl.getUniformLocation(
    program,
    "u_gridResolution",
  )!;
  textureUniformLocation = gl.getUniformLocation(program, "u_texture")!;
  textureSizeUniformLocation = gl.getUniformLocation(program, "u_textureSize")!;

  gl.uniform1i(textureUniformLocation, 0);
  gl.uniform2i(
    textureSizeUniformLocation,
    fontTexture.width,
    fontTexture.height,
  );

  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindVertexArray(null);
};

export const drawScreen = (gl: WebGL2RenderingContext) => {
  gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gl.clearColor(0.0, 0.0, 0.25, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.uniform2i(gridResolutionUniformLocation, 80, 25);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fontTexture.texture);

  gl.bindVertexArray(vao);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);
};
