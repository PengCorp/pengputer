import { Signal } from "../Toolbox/Signal";
import { getIsModifierKey } from "./isModifierKey";
import { KeyCode } from "./KeyCode";
import { KeyboardEvent as TerminalKeyboardEvent } from "./types";

export class Keyboard {
  private buffer: TerminalKeyboardEvent[];
  private pressed: KeyCode[];
  private werePressed: Set<KeyCode>;
  public keysDownChangedSignal: Signal<void> = new Signal();

  constructor() {
    this.buffer = [];
    this.pressed = [];
    this.werePressed = new Set();

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;

    this.pressed.push(e.code as KeyCode);
    this.werePressed.add(e.code as KeyCode);
    this.buffer.push({
      code: e.code as KeyCode,
      pressed: true,
    });
    this.keysDownChangedSignal.emit();
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    this.buffer.push({
      code: e.code as KeyCode,
      pressed: false,
    });
    this.keysDownChangedSignal.emit();
  }

  public take() {
    return this.buffer.shift();
  }

  public getIsKeyPressed(keyCode: KeyCode) {
    return this.pressed.includes(keyCode);
  }

  public getIsAnyKeyPressed() {
    return this.pressed.length > 0;
  }

  /** Takes a set of keyCodes. Returns the keyCode that was most recently pressed. Returns `null` otherwise. */
  public getLastPressedOf(keyCodes: string[]): string | null {
    let lastPressed = null;
    let lastPressedIndex = -1;

    for (const keyCode of keyCodes) {
      let index = this.pressed.findIndex((v) => v === keyCode);
      if (index > lastPressedIndex) {
        lastPressed = keyCode;
        lastPressedIndex = index;
      }
    }

    return lastPressed;
  }

  public getIsShift(): boolean {
    return (
      this.getIsKeyPressed("ShiftLeft") || this.getIsKeyPressed("ShiftRight")
    );
  }

  // ================== KEY WAS PRESSED =================================

  /** Get whether any key was pressed since last wasPressed reset. */
  public getWasKeyPressed(keyCode: KeyCode): boolean {
    return this.werePressed.has(keyCode);
  }

  /** Returns true if any non-modifier key was pressed. */
  public getWasAnyKeyPressed() {
    let anyKeyPressed = false;
    for (const key of this.werePressed) {
      if (!getIsModifierKey(key)) {
        anyKeyPressed = true;
        break;
      }
    }

    return anyKeyPressed;
  }

  /** Reset wasPressed state. */
  public resetWereKeysPressed() {
    this.werePressed.clear();
  }
}
