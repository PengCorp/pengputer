import GraphemeSplitter from "grapheme-splitter";
import { charArray } from "../types";

const splitter = new GraphemeSplitter();

export const splitStringIntoCharacters = (string: string): charArray => {
  const graphemes = splitter.splitGraphemes(string);
  const chars: charArray = [];
  for (const grapheme of graphemes) {
    if (grapheme === "\r\n") {
      chars.push("\r");
      chars.push("\n");
    } else {
      chars.push(grapheme);
    }
  }
  return chars;
};
