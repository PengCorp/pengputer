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

const escapeRegex = /^\x1b(\[(\d+;?)+.|.)/;
const controlCodeEscapeRegex = /^\x1b(.)/; // group 1 - character
const csiEscapeRegex = /^\x1b(\[((\d+;?)*)(.))/; // group 2 - numbers split by ;, group 4 - character

export const matchControlEscape = (s: string) => {
  const match = s.match(controlCodeEscapeRegex);
  if (match) {
    return {
      character: match[1],
    };
  }
  return null;
};

export const matchCsiEscape = (s: string) => {
  const match = s.match(csiEscapeRegex);
  if (match) {
    return {
      attributes: match[2].split(";").map((a) => Number(a)),
      character: match[4],
    };
  }
  return null;
};

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
    if (ch === "\x1b") {
      const escapeSequence = getEscapeSequence(
        `\x1b${chars.slice(i).join("")}`
      );
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
