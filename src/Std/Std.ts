import { classicColors } from "../Color/ansi";
import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { KeyCode } from "../Keyboard/types";
import { Screen } from "../Screen";
import { font9x16 } from "../Screen/font9x16";
import { font9x8 } from "../Screen/font9x8";
import { ClickListener } from "../Screen/Screen";
import {
  BOXED,
  BOXED_BOTTOM,
  BOXED_LEFT,
  BOXED_NO_BOX,
  BOXED_RIGHT,
  BOXED_TOP,
  CellAttributes,
  TextBuffer,
} from "../TextBuffer";
import { Vector, vectorAdd } from "../Toolbox/Vector";
import { Rect } from "../types";
import { ScreenMode } from "./constants";
import { readKey, readLine } from "./readLine";
import _ from "lodash";

export type ConsoleWriteAttributes = Partial<CellAttributes> & {
  reset?: boolean;
};
export type ConsoleSequence = (string | ConsoleWriteAttributes)[];

export class Std {
  private screen: Screen;

  private keyboard: Keyboard;

  private textBuffer: TextBuffer;

  private screenMode: ScreenMode;

  constructor(keyboard: Keyboard, textBuffer: TextBuffer, screen: Screen) {
    this.screenMode = ScreenMode.mode80x25_9x16;
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

  getConsoleScreenMode() {
    return this.screenMode;
  }

  setConsoleScreenMode(screenMode: ScreenMode) {
    switch (screenMode) {
      case ScreenMode.mode80x25_9x16:
        {
          const size = { w: 80, h: 25 };
          this.screen.setScreenMode(size, font9x16);
          this.textBuffer.setPageSize(size);
        }
        break;
      case ScreenMode.mode80x50_9x8:
        {
          const size = { w: 80, h: 50 };
          this.screen.setScreenMode(size, font9x8);
          this.textBuffer.setPageSize(size);
        }
        break;
      default:
        throw new Error("ScreenMode not defined.");
    }
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

  writeConsoleBox(length: number = 1) {
    if (length === 1) {
      this.textBuffer.updateCurrentAttributes({ boxed: BOXED });
      this.textBuffer.printAttributes(1);
      this.textBuffer.updateCurrentAttributes({ boxed: BOXED_NO_BOX });
      return;
    }

    this.textBuffer.updateCurrentAttributes({
      boxed: BOXED_TOP | BOXED_LEFT | BOXED_BOTTOM,
    });
    this.textBuffer.printAttributes(1);

    for (let i = 1; i < length - 1; i += 1) {
      this.textBuffer.updateCurrentAttributes({
        boxed: BOXED_TOP | BOXED_BOTTOM,
      });
      this.textBuffer.printAttributes(1);
    }

    this.textBuffer.updateCurrentAttributes({
      boxed: BOXED_TOP | BOXED_RIGHT | BOXED_BOTTOM,
    });
    this.textBuffer.printAttributes(1);
    this.textBuffer.updateCurrentAttributes({ boxed: BOXED_NO_BOX });
  }

  writeConsoleError(e: any) {
    this.writeConsole("\n\n");
    const pageWidth = this.getConsoleSize().w - 4;
    const errorMessage = e?.message || "Unknown error";
    this.writeConsole(
      `  ${_.padEnd("Software failure. Restarting...", pageWidth)}  \n  ${_.padEnd(`Penger Meditation: ${errorMessage}`, pageWidth)}  `,
      {
        bgColor: classicColors["red"],
        fgColor: classicColors["black"],
      },
    );
    this.writeConsole("\n\n", { reset: true });
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
