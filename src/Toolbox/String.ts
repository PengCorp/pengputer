import GraphemeSplitter from "grapheme-splitter";

export const padWithRightBias = (
  string: string,
  length: number,
  character: string = " "
) => {
  const spaceLeft = length - string.length;
  if (spaceLeft <= 0) {
    return string;
  }
  if (spaceLeft % 2 === 0) {
    const pad = spaceLeft / 2;
    return `${character.repeat(pad)}${string}${character.repeat(pad)}`;
  } else {
    const pad = Math.floor(spaceLeft / 2);
    return `${character.repeat(pad + 1)}${string}${character.repeat(pad)}`;
  }
};

const splitter = new GraphemeSplitter();

export const splitStringIntoCharacters = (string: string): string[] => {
  return splitter.splitGraphemes(string);
};

const escapeRegex = /^\x1B(s(f|b)[0-9a-f]{2}|i|b(s|r)|r|f)/;

export const getEscapeSequence = (string: string): string | null => {
  const match = string.match(escapeRegex);
  if (match) {
    return match[1];
  }
  return null;
};

export const getPlainStringFromString = (string: string): string => {
  const chars = splitStringIntoCharacters(string);

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    i += 1;
    if (ch === "\x1B") {
      const escapeSequence = getEscapeSequence(chars.slice(i - 1).join(""));
      if (escapeSequence) {
        chars.splice(i - 1, escapeSequence.length + 1);
      }
    }
  }

  return chars.join("");
};

export const getStringLength = (string: string) => {
  return splitStringIntoCharacters(getPlainStringFromString(string)).length;
};
