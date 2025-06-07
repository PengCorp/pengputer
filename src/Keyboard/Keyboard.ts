import { ANSI_LAYOUT } from "./ansiLayout";
import { getIsModifierKey } from "./isModifierKey";
import { KeyCode } from "./types";

export type TypeListener = (
  char: string | null,
  keyCode: string,
  ev: KeyboardEvent
) => void;
export type VoidListener = () => void;

export class Keyboard {
  private pressed: string[];
  private werePressed: Set<KeyCode>;
  private layout: any;

  private typeListeners: Array<TypeListener>;
  private allKeysUpListeners: Array<VoidListener>;

  private autoRepeatDelay: number;
  private autoRepeatDelayCounter: number;
  private autoRepeatInterval: number;
  private autoRepeatIntervalCounter: number;
  private autoRepeatEvent: KeyboardEvent | null;

  // CLEANUP(nic): maybe put this in an object
  private autorepeatKeyCode: string | null;
  private autorepeatKeyIsShiftDown: bool;
  private autorepeatKeyIsCapsOn: bool;

  constructor() {
    this.pressed = [];
    this.werePressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.typeListeners = [];
    this.allKeysUpListeners = [];

    this.autorepeatDelay = 250;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatInterval = 50;
    this.autorepeatIntervalCounter = this.autorepeatInterval;
    this.autorepeatKeyCode = null;
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;
    this.pressed.push(e.code);
    this.werePressed.add(e.code as KeyCode);

    const isShiftDown = e.getModifierState("Shift");
    const isCapsOn = e.getModifierState("CapsLock");
    this._simulateKeyPress(e.code, isShiftDown, isCapsOn);
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    if (this.autoRepeatKeyCode === e.code) {
      this._resetAutorepeat();
    }
    if (this.pressed.length === 0) {
      this.allKeysUpListeners.forEach((callback) => callback());
    }
  }

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

  private _resetAutorepeat() {
    this.autorepeatKeyCode = null;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatIntervalCounter = 0;
  }

  public printState() {
    console["log"](this.pressed);
  }

  public getIsKeyPressed(keyCode: string) {
    return this.pressed.includes(keyCode);
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

  public addTypeListener(callback: TypeListener) {
    this.typeListeners.push(callback);
    return () => {
      this.typeListeners = this.typeListeners.filter((cb) => cb !== callback);
    };
  }

  public addAllKeysUpListener(callback: VoidListener) {
    this.allKeysUpListeners.push(callback);
    return () => {
      this.allKeysUpListeners = this.allKeysUpListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private _getCharFromLayout(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    const shiftLayout = this.layout["@shift"];
    const capsLayout = this.layout["@caps"];
    const capsShiftLayout = this.layout["@caps-shift"];

    if (isCapsOn && capsLayout) {
      if (isShiftDown && capsShiftLayout && capsShiftLayout[keyCode]) {
        return capsShiftLayout[keyCode];
      }

      if (capsLayout[keyCode]) {
        return capsLayout[keyCode];
      }
    }

    if (isShiftDown) {
      if (shiftLayout && shiftLayout[keyCode]) {
        return shiftLayout[keyCode];
      }
      return null;
    }

    if (this.layout[keyCode]) {
      return this.layout[keyCode];
    }

    return null;
  }

  _simulateKeyPress(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    const char = this._getCharFromLayout(keyCode, isShiftDown, isCapsOn) ?? null;
    if (keyCode !== this.autorepeatKeyCode) {
      this._resetAutorepeat();
      this.autorepeatKeyCode = keyCode;
      this.autorepeatIsShiftDown = isShiftDown;
      this.autorepeatIsCapsOn = isCapsOn;
    }
    this.typeListeners.forEach((callback: any) => callback(char, keyCode));
  }

  simulateKeyDown(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    this.pressed.add(keyCode);
    this._simulateKeyPress(keyCode, isShiftDown, isCapsOn);
  }

  simulateKeyUp(keyCode: string) {
    if (this.autorepeatKeyCode === keyCode) {
      this._resetAutorepeat();
    }
  }

  update(dt: any) {
    if (this.autorepeatKeyCode != null) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._simulateKeyPress(this.autorepeatKeyCode, this.autorepeatIsShiftDown, this.autorepeatIsCapsOn);
        }
      }
    }
  }
}
