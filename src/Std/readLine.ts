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
            this.end();
            this.buffer.printString("^C");
            resolve(null);
            return;
          } else if (key === "KeyA") {
            this.home();
          } else if (key === "KeyE") {
            this.end();
          } else if (key === "KeyB") {
            this.arrowLeft();
          } else if (key === "KeyF") {
            this.arrowRight();
          }
        } else {
          if (key === "Tab") {
            this.tab();
          } else if (key === "Home") {
            this.home();
          } else if (key === "End") {
            this.end();
          } else if (char === "\n") {
            this.buffer.printString(char);
            resolve(this.result);
            this.keyboard.flushEventBuffer();
            return;
          } else if (char === "\b") {
            this.backspace();
          } else if (key === "Delete") {
            this.delete();
          } else if (key === "ArrowLeft") {
            this.arrowLeft();
          } else if (key === "ArrowRight") {
            this.arrowRight();
          } else if (key === "ArrowUp") {
            this.arrowUp();
          } else if (key === "ArrowDown") {
            this.arrowDown();
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

  private arrowUp() {
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

  private arrowDown() {
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

  private arrowRight() {
    if (this.curIndex < this.result.length) {
      this.curIndex += 1;
      this.moveCursor({ x: 1, y: 0 });
    }
  }

  private arrowLeft() {
    if (this.curIndex > 0) {
      this.curIndex -= 1;
      this.moveCursor({ x: -1, y: 0 });
    }
  }

  private delete() {
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

  private end() {
    this.moveCursor({
      x: this.result.length - this.curIndex,
      y: 0,
    });
    this.curIndex = this.result.length;
  }

  private home() {
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
