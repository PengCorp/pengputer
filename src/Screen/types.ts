export interface ScreenCharacterAttributes {
  fgColor: string;
  bgColor: string;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
}

export interface ScreenCharacter {
  character: string;
  attributes?: ScreenCharacterAttributes;
}

export interface ScreenBufferCharacter {
  character: string;
  attributes: ScreenCharacterAttributes;
}
