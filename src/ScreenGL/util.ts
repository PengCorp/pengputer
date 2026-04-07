import type { ImageTexture } from "./types";

/**
 * Creates a shader from a string.
 */
export function createShader(
  gl: WebGL2RenderingContext,
  shaderType: number,
  shaderSource: string,
) {
  // Create the shader object
  const shader = gl.createShader(shaderType);

  if (!shader) {
    throw new Error("Failed to create shader");
  }

  gl.shaderSource(shader, shaderSource);

  gl.compileShader(shader);

  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error("Failed to compile shader");
  }

  return shader;
}

/**
 * Creates a program from a set of shaders.
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  shaders: WebGLShader[],
) {
  const program = gl.createProgram();
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader);
  });

  gl.linkProgram(program);

  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw new Error("Failed to link program");
  }

  return program;
}

/**
 * Loads a texture from a file.
 */
export async function loadTexture(gl: WebGL2RenderingContext, url: string) {
  // Load the actual image
  const image = new Image();
  image.crossOrigin = "anonymous";

  return new Promise<ImageTexture>((resolve, reject) => {
    image.onload = () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      resolve({
        width: image.width,
        height: image.height,
        texture,
      });
    };

    image.onerror = () => {
      reject(new Error(`Failed to load texture: ${url}`));
    };

    image.src = url;
  });
}
