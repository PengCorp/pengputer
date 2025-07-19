export interface ScreenCharacterAttributes {
  fgColor: string;
  bgColor: string;
  blink: boolean;
  bold: boolean;
  reverseVideo: boolean;
  underline: boolean;
  halfBright: boolean;
}

export const compareScreenCharacterAttributes = (
  a: ScreenCharacterAttributes,
  b: ScreenCharacterAttributes,
) => {
  return (
    a.fgColor === b.fgColor &&
    a.bgColor === b.bgColor &&
    a.blink === b.blink &&
    a.bold === b.bold &&
    a.reverseVideo === b.reverseVideo &&
    a.underline === b.underline &&
    a.halfBright === b.halfBright
  );
};

export interface ScreenBufferCharacter {
  character: string;
  attributes: ScreenCharacterAttributes;
}

export const cloneScreenBufferCharacter = (
  a: ScreenBufferCharacter,
): ScreenBufferCharacter => {
  return {
    character: a.character,
    attributes: { ...a.attributes },
  };
};

export const compareScreenBufferCharacter = (
  a: ScreenBufferCharacter,
  b: ScreenBufferCharacter,
) => {
  return (
    a.character === b.character &&
    compareScreenCharacterAttributes(a.attributes, b.attributes)
  );
};
