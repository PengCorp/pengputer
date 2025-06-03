import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import { TypeListener } from "../Keyboard/Keyboard";

export const readLine = (
  screen: Screen,
  keyboard: Keyboard
): Promise<string> => {
  let unsubType: (() => void) | null = null;

  const promise = new Promise<string>((resolve) => {
    let result = "";
    let curIndex = 0;

    const onType: TypeListener = (char, key) => {
      if (char === "\n") {
        screen.printChar(char);
        resolve(result);
        return;
      } else if (char === "\b") {
        if (curIndex > 0) {
          const stringStart = result.slice(0, curIndex - 1);
          const stringEnd = result.slice(curIndex);
          result = stringStart + stringEnd;
          curIndex = Math.max(0, curIndex - 1);
          screen.setCursorPositionDelta({ x: -1, y: 0 }, true);
          screen.printString(stringEnd + " ");
          screen.setCursorPositionDelta(
            { x: -(stringEnd.length + 1), y: 0 },
            true
          );
        }
      } else if (key === "Delete") {
        if (curIndex < result.length) {
          const stringStart = result.slice(0, curIndex);
          const stringEnd = result.slice(curIndex + 1);
          result = stringStart + stringEnd;
          screen.printString(stringEnd + " ");
          screen.setCursorPositionDelta(
            { x: -(stringEnd.length + 1), y: 0 },
            true
          );
        }
      } else if (key === "ArrowLeft") {
        if (curIndex > 0) {
          curIndex -= 1;
          screen.setCursorPositionDelta({ x: -1, y: 0 }, true);
        }
      } else if (key === "ArrowRight") {
        if (curIndex < result.length) {
          curIndex += 1;
          screen.setCursorPositionDelta({ x: 1, y: 0 }, true);
        }
      } else if (char) {
        screen.printChar(char);
        result = result.slice(0, curIndex) + char + result.slice(curIndex);
        curIndex += 1;
      }
    };
    unsubType = keyboard.addTypeListener(onType);
  });

  return promise.finally(() => {
    unsubType?.();
  });
};

export const readKey = (keyboard: Keyboard) => {
  let unsubType: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    const onType: TypeListener = (char, key) => {
      if (char) {
        resolve();
      }
    };
    unsubType = keyboard.addTypeListener(onType);
  });

  return promise.finally(() => {
    unsubType?.();
  });
};
