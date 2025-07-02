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

  constructor() {
    this.pressed = [];
    this.werePressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.typeListeners = [];
    this.allKeysUpListeners = [];

    this.autoRepeatDelay = 250;
    this.autoRepeatDelayCounter = this.autoRepeatDelay;
    this.autoRepeatInterval = 50;
    this.autoRepeatIntervalCounter = this.autoRepeatInterval;
    this.autoRepeatEvent = null;
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;
    this.pressed.push(e.code);
    this.werePressed.add(e.code);
    this._onKeyTyped(e);
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    if (this.autoRepeatEvent?.code === e.code) {
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
    this.autoRepeatEvent = null;
    this.autoRepeatDelayCounter = this.autoRepeatDelay;
    this.autoRepeatIntervalCounter = 0;
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

  private _getCharFromLayout(ev: KeyboardEvent) {
    const { code: keyCode } = ev;
    const isShiftDown = ev.getModifierState("Shift");
    const isCapsOn = ev.getModifierState("CapsLock");

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

  private _onKeyTyped(ev: KeyboardEvent) {
    const char = this._getCharFromLayout(ev) ?? null;
    if (ev.code !== this.autoRepeatEvent?.code) {
      this._resetAutorepeat();
      this.autoRepeatEvent = ev;
    }
    this.typeListeners.forEach((callback) => callback(char, ev.code, ev));
  }

  public update(dt: any) {
    if (this.autoRepeatEvent) {
      this.autoRepeatDelayCounter -= dt;
      if (this.autoRepeatDelayCounter <= 0) {
        this.autoRepeatIntervalCounter -= dt;
        while (this.autoRepeatIntervalCounter <= 0) {
          this.autoRepeatIntervalCounter += this.autoRepeatInterval;
          this._onKeyTyped(this.autoRepeatEvent);
        }
      }
    }
  }
}
