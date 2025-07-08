import { PengTerm } from "../PengTerm";
import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { KeyCode } from "../Keyboard/KeyCode";
import { CellAttributes } from "../PengTerm/PengTerm";
import { Screen as PengputerScreen } from "../Screen";
import { Vector } from "../Toolbox/Vector";
import { Rect } from "../types";
import { readLine, waitForKeysUp } from "./readLine";
import { readTerm } from "./TermAdapter";
import { Keyboard } from "../Keyboard/Keyboard";

export class Std {
  private keyboard: Keyboard;

  private screen: PengputerScreen;

  private term: PengTerm;

  constructor(keyboard: Keyboard, screen: PengputerScreen, term: PengTerm) {
    this.keyboard = keyboard;
    this.screen = screen;
    this.term = term;
  }

  // Screen

  clearConsole() {
    // return this.screen.clear();
  }

  resetConsole() {
    return this.screen.reset();
  }

  getConsoleSize() {
    return this.screen.getSizeInCharacters();
  }

  getConsoleSizeInPixels() {
    return this.screen.getSizeInPixels();
  }

  getConsoleCharacterSize() {
    return this.term.screen.getPageSize();
  }

  setIsConsoleCursorVisible(isVisible: boolean) {
    if (isVisible) {
      this.screen.showCursor();
    } else {
      this.screen.hideCursor();
    }
  }

  setIsConsoleScrollable(isScrollable: boolean) {
    // this.screen.setIsScrollable(isScrollable);
  }

  getConsoleCursorSize() {
    return this.screen.getCursorSize();
  }

  setConsoleCursorSize(start: number, end: number) {
    return this.screen.setCursorSize(start, end);
  }

  getConsoleCursorPosition(): Vector {
    return this.term.screen.cursor.getPosition();
  }

  setConsoleCursorPosition(newPosition: Vector) {
    this.term.screen.cursor.setPosition(newPosition);
  }

  /** Does not perform wrapping. */
  moveConsoleCursorBy(delta: Vector) {
    if (delta.x < 0) {
      this.term.write(`\x1b[${delta.x}D`);
    } else if (delta.x > 0) {
      this.term.write(`\x1b[${delta.x}C`);
    }

    if (delta.y < 0) {
      this.term.write(`\x1b[${delta.y}A`);
    } else if (delta.y > 0) {
      this.term.write(`\x1b[${delta.y}B`);
    }
  }

  getConsoleAttributes(): CellAttributes {
    return this.term.screen.getCurrentAttributes();
  }

  setConsoleAttributes(attributes: CellAttributes) {
    return this.term.screen.setCurrentAttributes(attributes);
  }

  writeConsole(string: string) {
    return this.term.write(string);
  }

  /** Scrolls the whole console. Positive values scroll down, negative values scroll up. */
  scrollConsole(numberOfLines: number) {
    if (numberOfLines === 0) {
      return;
    }

    if (numberOfLines > 0) {
      this.term.screen.scrollUpBy(numberOfLines);
    } else {
      this.term.screen.scrollDownBy(numberOfLines);
    }
  }

  drawConsoleImage(image: CanvasImageSource, dx: number, dy: number) {
    // this.screen.drawImageAt(image, dx, dy);
  }

  // Keyboard

  readConsoleLine(
    ...args: Parameters<typeof readLine> extends [any, ...infer R] ? R : never
  ) {
    return readLine(this.term, ...args);
  }

  async readConsoleCharacter() {
    let result = undefined;
    while (result === undefined) {
      result = readTerm(this.term);
      if (!result) {
        await this.term.sendBufferUpdateSignal.getPromise();
        continue;
      }
      if (result.length > 1) {
        result = undefined;
        continue;
      }
      return result;
    }
  }

  waitForKeyboardKeysUp() {
    return waitForKeysUp(this.keyboard);
  }

  getIsKeyPressed(keyCode: KeyCode) {
    return this.keyboard.getIsKeyPressed(keyCode);
  }

  getLastKeyPressedOf(keyCodes: string[]) {
    return this.keyboard.getLastPressedOf(keyCodes);
  }

  getWasKeyPressed(keyCode: KeyCode) {
    return this.keyboard.getWasKeyPressed(keyCode);
  }

  getWasAnyKeyPressed() {
    return this.keyboard.getWasAnyKeyPressed();
  }

  resetKeyPressedHistory() {
    return this.keyboard.resetWereKeysPressed();
  }
}
