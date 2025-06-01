import { ANSI_LAYOUT } from "./ansiLayout";

export type TypeListener = (char: string | null, keyCode: string) => void;

export class Keyboard {
  private pressed: Set<any>;
  private layout: any;

  private typeListeners: Array<TypeListener>;
  private autorepeatDelay: number;
  private autorepeatDelayCounter: number;
  private autorepeatInterval: number;
  private autorepeatIntervalCounter: number;
  private autorepeatEvent: KeyboardEvent | null;

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
    this.autorepeatEvent = null;
  }

  _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    if (e.repeat) return;
    this.pressed.add(e.code);
    this._onKeyTyped(e);
  }

  _onKeyUp(e: KeyboardEvent) {
    this.pressed.delete(e.code);
    if (this.autorepeatEvent?.code === e.code) {
      this._resetAutorepeat();
    }
  }

  _resetAutorepeat() {
    this.autorepeatEvent = null;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatIntervalCounter = 0;
  }

  printState() {
    console["log"](this.pressed);
  }

  getIsKeyPressed(keyCode: string) {
    return this.pressed.has(keyCode);
  }

  addTypeListener(callback: TypeListener) {
    this.typeListeners.push(callback);
    return () => {
      this.typeListeners = this.typeListeners.filter((cb) => cb !== callback);
    };
  }

  _getCharFromLayout(ev: KeyboardEvent) {
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

  _onKeyTyped(ev: KeyboardEvent) {
    const char = this._getCharFromLayout(ev) ?? null;
    if (ev.code !== this.autorepeatEvent?.code) {
      this._resetAutorepeat();
      this.autorepeatEvent = ev;
    }
    this.typeListeners.forEach((callback: any) => callback(char, ev.code));
  }

  update(dt: any) {
    if (this.autorepeatEvent) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._onKeyTyped(this.autorepeatEvent);
        }
      }
    }
  }
}
