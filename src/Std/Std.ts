import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { KeyCode } from "../Keyboard/types";
import { PengTerm } from "../PengTerm";
import { Screen as PengputerScreen } from "../Screen";
import { ClickListener } from "../Screen/Screen";
import { ScreenCharacterAttributes } from "../Screen/types";
import { Vector, zeroVector } from "../Toolbox/Vector";
import { getRectFromVectorAndSize, Rect } from "../types";
import { readKey, readLine, waitForKeysUp } from "./readLine";

export class Std {
  private screen: PengputerScreen;

  private keyboard: Keyboard;

  private term: PengTerm;

  constructor(screen: PengputerScreen, keyboard: Keyboard, term: PengTerm) {
    this.screen = screen;
    this.keyboard = keyboard;
    this.term = term;
  }

  // Screen

  clearConsole() {
    return this.screen.clear();
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
    this.screen.setIsScrollable(isScrollable);
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
    this.term.screen.cursor.x = newPosition.x;
    this.term.screen.cursor.y = newPosition.y;
  }

  moveConsoleCursorBy(delta: Vector) {
    return this.screen.setCursorPositionDelta(delta);
  }

  getConsoleAttributes(): ScreenCharacterAttributes {
    return this.screen.getCurrentAttributes();
  }

  setConsoleAttributes(attributes: ScreenCharacterAttributes) {
    return this.screen.setCurrentAttributes(attributes);
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
    throw new Error("Not implemented");

    if (numberOfLines === 0) {
      return;
    }

    if (numberOfLines > 0) {
      this.screen.scrollUpRect(rect, numberOfLines);
    } else {
      this.screen.scrollDownRect(rect, -numberOfLines);
    }
  }

  drawConsoleImage(image: CanvasImageSource, dx: number, dy: number) {
    this.screen.drawImageAt(image, dx, dy);
  }

  // Keyboard

  readConsoleLine(
    ...args: Parameters<typeof readLine> extends [any, any, ...infer R]
      ? R
      : never
  ) {
    return readLine(this.screen, this.keyboard, ...args);
  }

  readConsoleKey() {
    return readKey(this.keyboard);
  }

  waitForKeyboardKeysUp() {
    return waitForKeysUp(this.keyboard);
  }

  getIsKeyPressed(keyCode: string) {
    return this.keyboard.getIsKeyPressed(keyCode);
  }

  getLastKeyPressedOf(keyCodes: string[]) {
    return this.keyboard.getLastPressedOf(keyCodes);
  }

  addKeyTypeListener(callback: TypeListener) {
    return this.keyboard.addTypeListener(callback);
  }

  addAllKeysUpListener(callback: VoidListener) {
    return this.keyboard.addAllKeysUpListener(callback);
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

  // Mouse

  addMouseScreenClickListener(listener: ClickListener) {
    return this.screen.addMouseClickListener(listener);
  }
}
