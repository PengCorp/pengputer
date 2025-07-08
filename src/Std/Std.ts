import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { KeyCode } from "../Keyboard/types";
import { Screen } from "../Screen";
import { ClickListener } from "../Screen/Screen";
import { ScreenCharacterAttributes } from "../Screen/types";
import { CellAttributes, TextBuffer } from "../TextBuffer/TextBuffer";
import { Vector, vectorAdd, zeroVector } from "../Toolbox/Vector";
import { getRectFromVectorAndSize, Rect } from "../types";
import { readKey, readLine, waitForKeysUp } from "./readLine";

export class Std {
  private screen: Screen;

  private keyboard: Keyboard;

  private textBuffer: TextBuffer;

  constructor(keyboard: Keyboard, textBuffer: TextBuffer, screen: Screen) {
    this.textBuffer = textBuffer;
    this.screen = screen;
    this.keyboard = keyboard;
  }

  // Screen

  clearConsole() {
    this.textBuffer.eraseScreen();
    this.textBuffer.cursor.setPosition({ x: 0, y: 0 });
  }

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
    return this.textBuffer.cursor.getPosition();
  }

  setConsoleCursorPosition(newPosition: Vector) {
    return this.textBuffer.cursor.setPosition(newPosition);
  }

  moveConsoleCursorBy(delta: Vector) {
    const pos = this.textBuffer.cursor.getPosition();
    const newPos = vectorAdd(pos, delta);
    this.textBuffer.cursor.setPosition(delta);
    this.textBuffer.cursor.wrapToBeInsidePage(this.textBuffer.getPageSize());
  }

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

  writeConsole(string: string) {
    return this.textBuffer.printString(string);
  }

  /** Scrolls the whole console. Positive values scroll down, negative values scroll up. */
  scrollConsole(numberOfLines: number) {
    // if (numberOfLines === 0) {
    //   return;
    // }
    // if (numberOfLines > 0) {
    //   this.screen.scrollUpRect(
    //     getRectFromVectorAndSize(zeroVector, this.screen.getSizeInCharacters()),
    //     numberOfLines
    //   );
    // } else {
    //   this.screen.scrollDownRect(
    //     getRectFromVectorAndSize(zeroVector, this.screen.getSizeInCharacters()),
    //     -numberOfLines
    //   );
    // }
  }

  /** Scrolls an area of the console. Positive values scroll down, negative values scroll up. */
  scrollConsoleRect(rect: Rect, numberOfLines: number) {
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
    this.screen.drawImageAt(image, dx, dy);
  }

  // Keyboard

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
