export interface ScreenCharacterAttributes {
  fgColor: string;
  bgColor: string;
  blink: boolean;
}

export interface ScreenCharacter {
  character: string;
  attributes: ScreenCharacterAttributes;
}
