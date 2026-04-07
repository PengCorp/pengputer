export interface ImageTexture {
  width: number;
  height: number;
  texture: WebGLTexture;
}

export interface ScreenCharacterAttributes {
  fgColor: string;
  bgColor: string;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
  underline: boolean;
  overline: boolean;
  strikethrough: boolean;
  halfBright: boolean;
  boxed: number;
}
