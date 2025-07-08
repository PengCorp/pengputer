import { Screen } from "../Screen";
import { PengTerm } from "../PengTerm";
import { Vector } from "../Toolbox/Vector";
import { readTerm } from "./TermAdapter";
import { ControlCharacter } from "../PengTerm/ControlCharacters";

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
  window.buf = term.sendBuffer;
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
    const read = readTerm(term);
    while (read === undefined) {
      await term.sendBufferUpdateSignal.getPromise();
    }
    console.log(read);

    debugger;
    if (read[0] === ControlCharacter.SS3) {
      switch (read[1]) {
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
    }
    if (read.length === 1) {
      if (read[0] === "\n") {
        return result;
      }

      result = `${result}${read[0]}`;
      console.log(result);
    }
  }
};

export const readKey = (keyboard: Keyboard) => {
  let unsubType: (() => void) | null = null;

  const promise = new Promise<{ char: string | null; key: string }>(
    (resolve) => {
      const onType: TypeListener = (char, key) => {
        if (!getIsModifierKey(key)) {
          resolve({ char, key });
        }
      };
      unsubType = keyboard.addTypeListener(onType);
    }
  );

  return promise.finally(() => {
    unsubType?.();
  });
};

export const waitForKeysUp = (keyboard: Keyboard) => {
  let unsub: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    const onType: VoidListener = () => {
      resolve();
    };
    unsub = keyboard.addAllKeysUpListener(onType);
  });

  return promise.finally(() => {
    unsub?.();
  });
};
