import { PengTerm } from "../PengTerm";
import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { KeyCode } from "../PengTerm/Keyboard/KeyCode";
import { CellAttributes } from "../PengTerm/PengTerm";
import { Screen as PengputerScreen } from "../Screen";
import { Vector } from "../Toolbox/Vector";
import { Rect } from "../types";
import { readKey, readLine, waitForKeysUp } from "./readLine";
import { readTerm } from "./TermAdapter";

export class Std {
  private screen: PengputerScreen;

  private term: PengTerm;

  constructor(screen: PengputerScreen, term: PengTerm) {
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

  moveConsoleCursorBy(delta: Vector) {
    // return this.screen.setCursorPositionDelta(delta);
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

  /** Scrolls an area of the console. Positive values scroll down, negative values scroll up. */
  scrollConsoleRect(rect: Rect, numberOfLines: number) {
    // throw new Error("Not implemented");
    // if (numberOfLines === 0) {
    //   return;
    // }
    // if (numberOfLines > 0) {
    //   this.screen.scrollUpRect(rect, numberOfLines);
    // } else {
    //   this.screen.scrollDownRect(rect, -numberOfLines);
    // }
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
    // return waitForKeysUp(this.keyboard);
  }

  getIsKeyPressed(keyCode: KeyCode) {
    return this.term.keyboard.getIsKeyPressed(keyCode);
  }

  getLastKeyPressedOf(keyCodes: string[]) {
    // return this.keyboard.getLastPressedOf(keyCodes);
  }

  addKeyTypeListener(callback: any) {
    // return this.keyboard.addTypeListener(callback);
  }

  addAllKeysUpListener(callback: any) {
    // return this.keyboard.addAllKeysUpListener(callback);
  }

  getWasKeyPressed(keyCode: KeyCode) {
    return this.term.keyboard.getWasKeyPressed(keyCode);
  }

  getWasAnyKeyPressed() {
    return this.term.keyboard.getWasAnyKeyPressed();
  }

  resetKeyPressedHistory() {
    return this.term.keyboard.resetWereKeysPressed();
  }
}
