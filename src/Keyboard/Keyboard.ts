import { ANSI_LAYOUT } from "./ansiLayout";

export class Keyboard {
  private pressed: Set<any>;
  private layout: any;

  private typeListeners: any;
  private autorepeatDelay: number;
  private autorepeatDelayCounter: number;
  private autorepeatInterval: number;
  private autorepeatIntervalCounter: number;
  private autorepeatKey: string | null;

  constructor() {
    this.pressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.typeListeners = [];

    this.autorepeatDelay = 250;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatInterval = 50;
    this.autorepeatIntervalCounter = this.autorepeatInterval;
    this.autorepeatKey = null;
  }

  _onKeyDown(e: any) {
    e.preventDefault();
    if (e.repeat) return;
    this.pressed.add(e.code);
    this._onKeyTyped(e.code);
  }

  _onKeyUp(e: any) {
    this.pressed.delete(e.code);
    if (this.autorepeatKey === e.code) {
      this._resetAutorepeat();
    }
  }

  _resetAutorepeat() {
    this.autorepeatKey = null;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatIntervalCounter = 0;
  }

  printState() {
    console["log"](this.pressed);
  }

  getIsKeyPressed(keyCode: any) {
    return this.pressed.has(keyCode);
  }

  addTypeListener(callback: any) {
    this.typeListeners.push(callback);
    return () => {
      this.typeListeners = this.typeListeners.filter(
        (cb: any) => cb !== callback
      );
    };
  }

  _getCharFromLayout(keyCode: any) {
    const shiftLayout = this.layout["@shift"];
    const capsLayout = this.layout["@caps"];
    const capsShiftLayout = this.layout["@caps-shift"];

    let isShiftDown =
      this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight");
    let isCapsDown = this.pressed.has("CapsLock");

    if (isCapsDown && capsLayout) {
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

  _onKeyTyped(key: any) {
    const char = this._getCharFromLayout(key) ?? null;
    if (key !== this.autorepeatKey) {
      this._resetAutorepeat();
      this.autorepeatKey = key;
    }
    this.typeListeners.forEach((callback: any) => callback(char, key));
  }

  update(dt: any) {
    if (this.autorepeatKey) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._onKeyTyped(this.autorepeatKey);
        }
      }
    }
  }
}
