interface DoubleBufferFBO {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
}

const createFBO = (
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): DoubleBufferFBO => {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { fbo, texture };
};

export class DoubleBuffer {
  private gl: WebGL2RenderingContext;
  private fboA: DoubleBufferFBO;
  private fboB: DoubleBufferFBO;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    this.fboA = createFBO(gl, gl.canvas.width, gl.canvas.height);
    this.fboB = createFBO(gl, gl.canvas.width, gl.canvas.height);
  }
}
