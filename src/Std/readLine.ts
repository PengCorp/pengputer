import { Screen } from "../Screen";
import { PengTerm } from "../PengTerm";
import { Vector } from "../Toolbox/Vector";
import { readTerm } from "./TermAdapter";
import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { getIsPrintable } from "../Screen/getIsPrintable";
import { Keyboard } from "../Keyboard/Keyboard";

export const readLine = async (
  term: PengTerm,
  {
    autoCompleteStrings = [],
    previousEntries = [],
  }: {
    autoCompleteStrings?: string[];
    previousEntries?: string[];
  } = {}
) => {
  let isUsingPreviousEntry = false;
  let previousEntryIndex = 0;
  let savedResult = "";

  const moveCursor = (delta: Vector) => {
    const pageSize = term.screen.getPageSize();
    const curPos = term.screen.cursor.getPosition();
    curPos.x += delta.x;
    curPos.y += delta.y;
    term.screen.cursor.setPosition(curPos);
    term.screen.cursor.wrapToBeInsidePage(pageSize);
  };

  let lineRead = false;
  let result = "";
  let curIndex = 0;
  while (!lineRead) {
    let read = readTerm(term);
    while (read === undefined) {
      await term.sendBufferUpdateSignal.getPromise();
      read = readTerm(term);
    }

    if (read[0] === ControlCharacter.SS3) {
      switch (read[1]) {
        case "A":
          if (previousEntries.length > 0) {
            let replaceWith = "";
            if (!isUsingPreviousEntry) {
              isUsingPreviousEntry = true;
              savedResult = result;
              previousEntryIndex = previousEntries.length - 1;
              replaceWith = previousEntries[previousEntryIndex];
            } else if (previousEntryIndex > 0) {
              previousEntryIndex -= 1;
              replaceWith = previousEntries[previousEntryIndex];
            }
            if (replaceWith) {
              moveCursor({ x: -curIndex, y: 0 });
              term.write(" ".repeat(result.length));
              moveCursor({ x: -result.length, y: 0 });
              term.write(replaceWith);
              result = replaceWith;
              curIndex = replaceWith.length;
            }
          }
          break;
        case "B":
          if (
            isUsingPreviousEntry &&
            previousEntryIndex < previousEntries.length
          ) {
            let replaceWith = "";
            previousEntryIndex += 1;
            if (previousEntryIndex < previousEntries.length) {
              replaceWith = previousEntries[previousEntryIndex];
            } else {
              replaceWith = savedResult;
            }
            moveCursor({ x: -curIndex, y: 0 });
            term.write(" ".repeat(result.length));
            moveCursor({ x: -result.length, y: 0 });
            term.write(replaceWith);
            result = replaceWith;
            curIndex = replaceWith.length;
          }
          break;
        case "D":
          if (curIndex > 0) {
            curIndex -= 1;
            moveCursor({ x: -1, y: 0 });
          }
          break;
        case "C":
          if (curIndex < result.length) {
            curIndex += 1;
            moveCursor({ x: 1, y: 0 });
          }
          break;
      }
    } else if (read.length === 1) {
      if (read[0] === "\n") {
        term.write(read[0]);
        return result;
      }
      if (read[0] === ControlCharacter.HT) {
        isUsingPreviousEntry = false;
        let tokens = result.split(" ");
        if (tokens.length === 0) return;
        let token = tokens[tokens.length - 1];
        if (token.length === 0) return;

        const matchingAutoCompleteStrings = autoCompleteStrings.filter((s) =>
          s.startsWith(token)
        );

        if (matchingAutoCompleteStrings.length === 1) {
          const autoCompleteString = matchingAutoCompleteStrings[0];
          let prefix = autoCompleteString.slice(0, token.length);
          if (prefix === token) {
            moveCursor({
              x: -token.length,
              y: 0,
            });
            term.write(autoCompleteString);
            result =
              result.slice(0, result.length - token.length) +
              autoCompleteString;
            curIndex = result.length;
          }
        }
      }
      if (!getIsPrintable(read[0])) {
        continue;
      }

      isUsingPreviousEntry = false;
      const rest = read[0] + result.slice(curIndex);
      term.write(rest);
      moveCursor({ x: -rest.length + 1, y: 0 });
      result = result.slice(0, curIndex) + rest;
      curIndex += 1;
    }
  }
};

export const readKey = async (term: PengTerm) => {
  let read = readTerm(term);
  while (read === undefined) {
    await term.sendBufferUpdateSignal.getPromise();
    read = readTerm(term);
  }
};

export const waitForKeysUp = async (keyboard: Keyboard) => {
  while (keyboard.getIsAnyKeyPressed()) {
    await keyboard.keysDownChangedSignal.getPromise();
  }
};
