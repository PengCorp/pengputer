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

  private autorepeatDelay: number;
  private autorepeatDelayCounter: number;
  private autorepeatInterval: number;
  private autorepeatIntervalCounter: number;
  private autorepeatKey: Key | null;

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
    this.autorepeatKey = null;
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;
    this.pressed.push(e.code);
    this.werePressed.add(e.code as KeyCode);

    const code = e.code;
    const isShiftDown = e.getModifierState("Shift");
    const isCapsOn = e.getModifierState("CapsLock");
    this._simulateKeyPress({ code, isShiftDown, isCapsOn });
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    if (this.autorepeatKey !== null && this.autorepeatKey.code === e.code) {
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
    this.autorepeatKey = null;
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

  private _getCharFromLayout(key: Key) {
    const shiftLayout = this.layout["@shift"];
    const capsLayout = this.layout["@caps"];
    const capsShiftLayout = this.layout["@caps-shift"];

    if (key.isCapsOn && capsLayout) {
      if (key.isShiftDown && capsShiftLayout && capsShiftLayout[key.code]) {
        return capsShiftLayout[key.code];
      }

      if (capsLayout[key.code]) {
        return capsLayout[key.code];
      }
    }

    if (key.isShiftDown) {
      if (shiftLayout && shiftLayout[key.code]) {
        return shiftLayout[key.code];
      }
      return null;
    }

    if (this.layout[key.code]) {
      return this.layout[key.code];
    }

    return null;
  }

  _simulateKeyPress(key: Key) {
    const char = this._getCharFromLayout(key) ?? null;
    if (this.autorepeatKey === null || key.code !== this.autorepeatKey.code) {
      this._resetAutorepeat();
      this.autorepeatKey = key;
    }
    this.typeListeners.forEach((callback: any) => callback(char, key.code));
  }

  simulateKeyDown(key: Key) {
    this.pressed.add(key.code);
    this._simulateKeyPress(key);
  }

  simulateKeyUp(keyCode: string) {
    if (this.autorepeatKey !== null && this.autorepeatKey.code === keyCode) {
      this._resetAutorepeat();
    }
  }

  update(dt: any) {
    if (this.autorepeatKey !== null) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._simulateKeyPress(this.autorepeatKey);
        }
      }
    }
  }
}
