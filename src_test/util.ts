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
  if (compiled) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  throw new Error("Failed to compile shader");
}

export function createProgram(
  gl: WebGL2RenderingContext,
  shaders: WebGLShader[],
  beforeLink: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
  ) => void = () => undefined,
) {
  const program = gl.createProgram();
  shaders.forEach(function (shader) {
    gl.attachShader(program, shader);
  });

  beforeLink(gl, program);

  gl.linkProgram(program);

  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (linked) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  throw new Error("Failed to link program");
}

export async function loadTexture(gl: WebGL2RenderingContext, url: string) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Put a 1x1 pixel placeholder while loading
  const pixel = new Uint8Array([0, 0, 255, 255]); // blue pixel
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel,
  );

  // Load the actual image
  const image = new Image();
  image.crossOrigin = "anonymous";

  return new Promise<WebGLTexture>((resolve, reject) => {
    image.onload = () => {
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

      resolve(texture);
    };

    image.onerror = () => {
      reject(new Error(`Failed to load texture: ${url}`));
    };

    image.src = url;
  });
}
