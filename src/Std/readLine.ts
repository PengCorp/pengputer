import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { getIsModifierKey } from "../Keyboard/isModifierKey";
import { Vector } from "../Toolbox/Vector";
import { TextBuffer } from "../TextBuffer";
import { KeyCode } from "../Keyboard/types";

interface AutoCompleteInfo {
  autoCompleteStrings?: string[];
  previousEntries?: string[];
}

class ReadLine {
  private screen: Screen;
  private keyboard: Keyboard;
  private buffer: TextBuffer;
  private previousEntries: string[];
  private autoCompleteStrings: string[];

  private isUsingPreviousEntry = false;
  private previousEntryIndex = 0;
  private savedResult = "";
  private result = "";
  private curIndex = 0;

  constructor(
    screen: Screen,
    keyboard: Keyboard,
    buffer: TextBuffer,
    autoCompleteInfo: AutoCompleteInfo = {},
  ) {
    this.screen = screen;
    this.keyboard = keyboard;
    this.buffer = buffer;
    this.previousEntries = autoCompleteInfo.previousEntries ?? [];
    this.autoCompleteStrings = autoCompleteInfo.autoCompleteStrings ?? [];

    keyboard.flushEventBuffer();
  }

  private moveCursor(delta: Vector) {
    const { buffer } = this;

    const pageSize = buffer.getPageSize();
    const curPos = buffer.cursor.getPosition();
    curPos.x += delta.x;
    curPos.y += delta.y;
    buffer.cursor.setPosition(curPos);
    buffer.cursor.wrapToBeInsidePage(pageSize);
  }

  public run() {
    const promise = new Promise<string | null>(async (resolve) => {
      while (true) {
        const ev = await this.keyboard.waitForNextEvent();

        if (!ev.pressed) continue;

        const key = ev.code;
        const char = ev.char;

        if (ev.isControlDown) {
          if (key === "KeyC") {
            this.goToEnd();
            this.buffer.printString("^C");
            resolve(null);
            return;
          } else if (key === "KeyA") {
            this.goHome();
          } else if (key === "KeyE") {
            this.goToEnd();
          } else if (key === "KeyB") {
            this.moveBackwards();
          } else if (key === "KeyF") {
            this.moveForwards();
          } else if (key === "KeyD") {
            this.deleteCharacter();
          }
        } else if (ev.isAltDown) {
          switch (key) {
            case "KeyB":
              this.goBackwardsByWord();
              break;
            case "KeyF":
              this.goForwardsByWord();
              break;
            case "KeyC":
              this.capitalizeWord();
              break;
            case "KeyL":
              this.lowercaseWord();
              break;
            case "KeyU":
              this.uppercaseWord();
              break;
            case "KeyD":
              this.deleteWord();
              break;
            default:
              break;
          }
        } else {
          if (key === "Tab") {
            this.tab();
          } else if (key === "Home") {
            this.goHome();
          } else if (key === "End") {
            this.goToEnd();
          } else if (char === "\n") {
            this.buffer.printString(char);
            resolve(this.result);
            this.keyboard.flushEventBuffer();
            return;
          } else if (char === "\b") {
            this.backspace();
          } else if (key === "Delete") {
            this.deleteCharacter();
          } else if (key === "ArrowLeft") {
            this.moveBackwards();
          } else if (key === "ArrowRight") {
            this.moveForwards();
          } else if (key === "ArrowUp") {
            this.navigateHistoryBackwards();
          } else if (key === "ArrowDown") {
            this.navigateHistoryForwards();
          } else if (char) {
            this.isUsingPreviousEntry = false;
            const rest = char + this.result.slice(this.curIndex);
            this.buffer.printString(rest);
            this.moveCursor({ x: -rest.length + 1, y: 0 });
            this.result = this.result.slice(0, this.curIndex) + rest;
            this.curIndex += 1;
          }
        }
      }
    });

    return promise;
  }

  private navigateHistoryBackwards() {
    if (this.previousEntries.length > 0) {
      let replaceWith = "";
      if (!this.isUsingPreviousEntry) {
        this.isUsingPreviousEntry = true;
        this.savedResult = this.result;
        this.previousEntryIndex = this.previousEntries.length - 1;
        replaceWith = this.previousEntries[this.previousEntryIndex];
      } else if (this.previousEntryIndex > 0) {
        this.previousEntryIndex -= 1;
        replaceWith = this.previousEntries[this.previousEntryIndex];
      }
      if (replaceWith) {
        this.moveCursor({ x: -this.curIndex, y: 0 });
        this.buffer.printString(" ".repeat(this.result.length));
        this.moveCursor({ x: -this.result.length, y: 0 });
        this.buffer.printString(replaceWith);
        this.result = replaceWith;
        this.curIndex = replaceWith.length;
      }
    }
  }

  private navigateHistoryForwards() {
    if (
      this.isUsingPreviousEntry &&
      this.previousEntryIndex < this.previousEntries.length
    ) {
      let replaceWith = "";
      this.previousEntryIndex += 1;
      if (this.previousEntryIndex < this.previousEntries.length) {
        replaceWith = this.previousEntries[this.previousEntryIndex];
      } else {
        replaceWith = this.savedResult;
      }
      this.moveCursor({ x: -this.curIndex, y: 0 });
      this.buffer.printString(" ".repeat(this.result.length));
      this.moveCursor({ x: -this.result.length, y: 0 });
      this.buffer.printString(replaceWith);
      this.result = replaceWith;
      this.curIndex = replaceWith.length;
    }
  }

  private moveForwards() {
    if (this.curIndex < this.result.length) {
      this.curIndex += 1;
      this.moveCursor({ x: 1, y: 0 });
    }
  }

  private moveBackwards() {
    if (this.curIndex > 0) {
      this.curIndex -= 1;
      this.moveCursor({ x: -1, y: 0 });
    }
  }

  private deleteCharacter() {
    if (this.curIndex < this.result.length) {
      this.isUsingPreviousEntry = false;
      const stringStart = this.result.slice(0, this.curIndex);
      const stringEnd = this.result.slice(this.curIndex + 1);
      this.result = stringStart + stringEnd;
      this.buffer.printString(stringEnd + " ");
      this.moveCursor({ x: -(stringEnd.length + 1), y: 0 });
    }
  }

  private backspace() {
    if (this.curIndex > 0) {
      this.isUsingPreviousEntry = false;
      const stringStart = this.result.slice(0, this.curIndex - 1);
      const stringEnd = this.result.slice(this.curIndex);
      this.result = stringStart + stringEnd;
      this.curIndex = this.curIndex - 1;
      this.moveCursor({ x: -1, y: 0 });
      this.buffer.printString(stringEnd + " ");
      this.moveCursor({ x: -(stringEnd.length + 1), y: 0 });
    }
  }

  private goToEnd() {
    this.moveCursor({
      x: this.result.length - this.curIndex,
      y: 0,
    });
    this.curIndex = this.result.length;
  }

  private goHome() {
    this.moveCursor({ x: -this.curIndex, y: 0 });
    this.curIndex = 0;
  }

  private tab() {
    if (
      this.autoCompleteStrings.length > 0 &&
      this.curIndex === this.result.length
    ) {
      this.isUsingPreviousEntry = false;
      let tokens = this.result.split(" ");
      if (tokens.length === 0) return;
      let token = tokens[tokens.length - 1];
      if (token.length === 0) return;

      const matchingAutoCompleteStrings = this.autoCompleteStrings.filter((s) =>
        s.startsWith(token),
      );

      if (matchingAutoCompleteStrings.length === 1) {
        const autoCompleteString = matchingAutoCompleteStrings[0];
        let prefix = autoCompleteString.slice(0, token.length);
        if (prefix === token) {
          this.moveCursor({
            x: -token.length,
            y: 0,
          });
          this.buffer.printString(autoCompleteString);
          this.result =
            this.result.slice(0, this.result.length - token.length) +
            autoCompleteString;
          this.curIndex = this.result.length;
        }
      }
    }
  }

  /* word motions */

  private shouldStopWordMotion() {
    const chr = this.result[this.curIndex];
    return chr && !chr.match(/[a-zA-Z0-9]/);
  }

  private goBackwardsByWord() {
    const prevIndex = this.curIndex;

    /* if we are already on a character that stops our motion, skip it */
    // while (--this.curIndex > 0 && this.shouldStopWordMotion());
    while (true) {
      this.curIndex -= 1;
      if (this.curIndex > 0 && this.shouldStopWordMotion()) {
        continue;
      }
      break;
    }

    while (this.curIndex >= 0 && !this.shouldStopWordMotion()) {
      this.curIndex -= 1;
    }

    this.curIndex++; /* move to the start of the word */

    this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
  }

  private goForwardsByWord() {
    const prevIndex = this.curIndex;
    const inputLen = this.result.length;

    /* if we are already on a character that stops our motion, skip it */
    while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
  }

  private capitalizeWord() {
    let prevIndex = this.curIndex;
    const inputLen = this.result.length;

    /* M-c (Alt+C) motion only upcases the first letter
     * it's on, but moves through the whole word. */

    /* move to the first character that can be upcased and upcase that */
    while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
    prevIndex = this.curIndex;

    while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    const left = this.result.slice(0, prevIndex);
    const middle = this.result[prevIndex].toUpperCase();
    const right = this.result.slice(prevIndex + 1, inputLen);

    this.result = left + middle + right;
    this.buffer.printString(middle);

    this.moveCursor({ x: this.curIndex - prevIndex - 1, y: 0 });
  }

  private lowercaseWord() {
    const prevIndex = this.curIndex;
    const inputLen = this.result.length;

    /* if we are already on a character that stops our motion, skip it */
    while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    const left = this.result.slice(0, prevIndex);
    const middle = this.result.slice(prevIndex, this.curIndex).toLowerCase();
    const right = this.result.slice(this.curIndex, inputLen);

    this.result = left + middle + right;
    this.buffer.printString(middle);
  }

  private uppercaseWord() {
    const prevIndex = this.curIndex;
    const inputLen = this.result.length;

    /* if we are already on a character that stops our motion, skip it */
    while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    const left = this.result.slice(0, prevIndex);
    const middle = this.result.slice(prevIndex, this.curIndex).toUpperCase();
    const right = this.result.slice(this.curIndex, inputLen);

    this.result = left + middle + right;
    this.buffer.printString(middle);
  }

  private deleteWord() {
    const prevIndex = this.curIndex;
    const inputLen = this.result.length;

    /* if we are already on a character that stops our motion, skip it */
    while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
      this.curIndex++;
    }

    const left = this.result.slice(0, prevIndex);
    // const middle = this.result.slice(prevIndex, this.curIndex); /* this is the part we delete */
    const right = this.result.slice(this.curIndex, inputLen);

    this.buffer.printString(right + " ".repeat(this.curIndex - prevIndex));
    this.moveCursor({
      x: prevIndex - inputLen,
      y: 0,
    }); /* printString moves the screen cursor */
    this.result = left + right;
    this.curIndex = prevIndex; /* no movement is needed */
  }
}

export const readLine = async (
  screen: Screen,
  keyboard: Keyboard,
  buffer: TextBuffer,
  autoCompleteInfo: AutoCompleteInfo = {},
) => {
  const rl = new ReadLine(screen, keyboard, buffer, autoCompleteInfo);
  return rl.run();
};

export const readKey = async (
  keyboard: Keyboard,
): Promise<{ char: string | null; key: KeyCode }> => {
  keyboard.flushEventBuffer();
  while (true) {
    const ev = await keyboard.waitForNextEvent();
    if (!ev.pressed) continue;
    if (ev.isModifier) continue;
    return {
      char: ev.char,
      key: ev.code,
    };
  }
};
