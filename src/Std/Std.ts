import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { KeyCode } from "../Keyboard/types";
import { Screen } from "../Screen";
import { ClickListener } from "../Screen/Screen";
import { CellAttributes, TextBuffer } from "../TextBuffer";
import { Vector, vectorAdd } from "../Toolbox/Vector";
import { Rect } from "../types";
import { readKey, readLine } from "./readLine";

export type ConsoleWriteAttributes = Partial<CellAttributes> & {
  reset?: boolean;
};
export type ConsoleSequence = (string | ConsoleWriteAttributes)[];

export class Std {
  private screen: Screen;

  private keyboard: Keyboard;

  private textBuffer: TextBuffer;

  constructor(keyboard: Keyboard, textBuffer: TextBuffer, screen: Screen) {
    this.textBuffer = textBuffer;
    this.screen = screen;
    this.keyboard = keyboard;
  }

  /* ===================== CONSOLE CONTROL ========================= */

  /** Clears screen buffer with current attributes, resets cursor to start of screen. */
  clearConsole() {
    this.screen.clear();
    this.textBuffer.eraseScreen();
    this.textBuffer.cursor.setPosition({ x: 0, y: 0 });
  }

  /** Reset console attributes, cursor properties. Keeps screen buffer intact. */
  resetConsole() {
    this.textBuffer.resetCurrentAttributes();
    this.screen.reset();
  }

  getConsoleSize() {
    return this.screen.getSizeInCharacters();
  }

  getConsoleSizeInPixels() {
    return this.screen.getSizeInPixels();
  }

  getConsoleCharacterSize() {
    return this.screen.getCharacterSize();
  }

  /* ===================== CONSOLE CURSOR CONTROL ========================= */

  setIsConsoleCursorVisible(isVisible: boolean) {
    if (isVisible) {
      this.screen.showCursor();
    } else {
      this.screen.hideCursor();
    }
  }

  getConsoleCursorSize() {
    return this.screen.getCursorSize();
  }

  setConsoleCursorSize(start: number, end: number) {
    return this.screen.setCursorSize(start, end);
  }

  getConsoleCursorPosition(): Vector {
    return this.textBuffer.cursor.getPosition();
  }

  setConsoleCursorPosition(newPosition: Vector) {
    return this.textBuffer.cursor.setPosition(newPosition);
  }

  /** Moves console cursor by provided delta. Wraps cursor along sides of the screen to stay visible. */
  moveConsoleCursorBy(delta: Vector) {
    const pos = this.textBuffer.cursor.getPosition();
    const newPos = vectorAdd(pos, delta);
    this.textBuffer.cursor.setPosition(newPos);
    this.textBuffer.cursor.wrapToBeInsidePage(this.textBuffer.getPageSize());
  }

  /* ===================== CONSOLE ATTRIBUTES ========================= */

  getConsoleAttributes(): CellAttributes {
    return this.textBuffer.getCurrentAttributes();
  }

  setConsoleAttributes(attributes: CellAttributes) {
    return this.textBuffer.setCurrentAttributes(attributes);
  }

  updateConsoleAttributes(update: Partial<CellAttributes>) {
    return this.textBuffer.updateCurrentAttributes(update);
  }

  resetConsoleAttributes() {
    return this.textBuffer.resetCurrentAttributes();
  }

  updateConsoleRectAttributes(rect: Rect, attr: Partial<CellAttributes>) {
    const page = this.textBuffer.getPage(0);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        const cell = page.lines[y]?.cells[x];
        if (cell) {
          cell.updateAttributes(attr);
        }
      }
    }
  }

  /* ===================== CONSOLE WRITING ========================= */

  getConsoleSequenceLength(sequence: ConsoleSequence) {
    return this.getConsoleSequenceText(sequence).length;
  }

  getConsoleSequenceText(sequence: ConsoleSequence) {
    return sequence.filter((i) => typeof i === "string").join("");
  }

  /**
   * Writes a sequence of strings and attribute changes to console.
   *
   * Only first line of text is taken into consideration while centering.
   */
  writeConsoleSequence(
    sequence: ConsoleSequence,
    opt: { align?: "center"; reset?: false; resetBefore?: false } = {},
  ) {
    const { align, reset, resetBefore } = opt;

    if (resetBefore) {
      this.resetConsoleAttributes();
    }

    if (align === "center") {
      const consoleSize = this.getConsoleSize();
      const sequenceText = this.getConsoleSequenceText(sequence).split("\n")[0];

      const padding = " ".repeat((consoleSize.w - sequenceText.length) / 2);
      this.writeConsole(padding);
    }

    for (const item of sequence) {
      if (typeof item === "string") {
        this.textBuffer.printString(item);
      } else {
        if (item.reset) {
          this.resetConsoleAttributes();
        } else {
          this.updateConsoleAttributes(item);
        }
      }
    }

    if (reset) {
      this.resetConsoleAttributes();
    }
  }

  writeConsole(string: string, attr?: ConsoleWriteAttributes) {
    if (attr) {
      if (attr.reset) {
        this.resetConsoleAttributes();
      } else {
        this.updateConsoleAttributes(attr);
      }
    }
    return this.textBuffer.printString(string);
  }

  writeConsoleCharacter(character: string, attr?: ConsoleWriteAttributes) {
    if (attr) {
      if (attr.reset) {
        this.resetConsoleAttributes();
      } else {
        this.updateConsoleAttributes(attr);
      }
    }
    return this.textBuffer.printCharacter(character);
  }

  /** Writes the provided number of cells with current console attributes without changing underlying rune. */
  writeConsoleAttributes(length: number = 1) {
    this.textBuffer.printAttributes(length);
  }

  /* ===================== CONSOLE SCROLLING ========================= */

  /** Scrolls the whole console. Positive values scroll down, negative values scroll up. */
  scrollConsole(numberOfLines: number) {
    if (numberOfLines === 0) {
      return;
    }
    if (numberOfLines > 0) {
      this.textBuffer.scrollDownBy(numberOfLines);
    } else {
      this.textBuffer.scrollUpBy(numberOfLines);
    }
  }

  /* ===================== CONSOLE IMAGE SUPPORT ========================= */

  drawConsoleImage(image: CanvasImageSource, dx: number, dy: number) {
    this.screen.drawImageAt(image, dx, dy);
  }

  /* ===================== KEYBOARD ========================= */

  readConsoleLine(
    ...args: Parameters<typeof readLine> extends [any, any, any, ...infer R]
      ? R
      : never
  ) {
    return readLine(this.screen, this.keyboard, this.textBuffer, ...args);
  }

  readConsoleKey() {
    return readKey(this.keyboard);
  }

  getIsKeyPressed(keyCode: KeyCode) {
    return this.keyboard.getIsKeyPressed(keyCode);
  }

  flushKeyboardEvents() {
    return this.keyboard.flushEventBuffer();
  }

  getNextKeyboardEvent() {
    return this.keyboard.getNextEvent();
  }

  async waitForNextKeyboardEvent() {
    return await this.keyboard.waitForNextEvent();
  }

  /* ===================== MOUSE ========================= */

  addMouseScreenClickListener(listener: ClickListener) {
    return this.screen.addMouseClickListener(listener);
  }
}
