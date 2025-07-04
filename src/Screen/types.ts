export interface ScreenCharacterAttributes {
  fgColor: string;
  bgColor: string;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
  underline: boolean;
  halfBright: boolean;
}

export interface ScreenCharacter {
  character: string;
  attributes?: ScreenCharacterAttributes;
}

export interface ScreenBufferCharacter {
  character: string;
  attributes: ScreenCharacterAttributes;
}
