import { Signal } from "../Toolbox/Signal";
import { ANSI_LAYOUT } from "./ansiLayout";
import { getIsModifierKey } from "./isModifierKey";
import { KeyCode, PengKeyboardEvent } from "./types";

export type TypeListener = (
  char: string | null,
  keyCode: KeyCode,
  ev: PengKeyboardEvent,
) => void;
export type VoidListener = () => void;

export class Keyboard {
  private pressed: Set<KeyCode>;
  private layout: any;

  private autoRepeatDelay: number;
  private autoRepeatDelayCounter: number;
  private autoRepeatInterval: number;
  private autoRepeatIntervalCounter: number;
  private autoRepeatCode: KeyCode | null;

  private eventBuffer: PengKeyboardEvent[] = [];

  private newEventSignal: Signal<void> = new Signal();

  private isCapsOn: boolean = false;

  constructor() {
    this.pressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.autoRepeatDelay = 250;
    this.autoRepeatDelayCounter = this.autoRepeatDelay;
    this.autoRepeatInterval = 50;
    this.autoRepeatIntervalCounter = this.autoRepeatInterval;
    this.autoRepeatCode = null;
  }

  private getModifiersState() {
    return {
      isShiftDown:
        this.pressed.has("ShiftLeft") || this.pressed.has("ShiftRight"),
      isControlDown:
        this.pressed.has("ControlLeft") || this.pressed.has("ControlRight"),
      isAltDown: this.pressed.has("AltLeft") || this.pressed.has("AltRight"),
      isMetaDown: this.pressed.has("MetaLeft") || this.pressed.has("MetaRight"),
      isCapsOn: this.isCapsOn,
    };
  }

  private getEventFromCode(kc: KeyCode): PengKeyboardEvent {
    const ev: PengKeyboardEvent = {
      code: kc,
      char: null,
      pressed: false,
      isAutoRepeat: false,
      ...this.getModifiersState(),
      isModifier: getIsModifierKey(kc),
    };
    ev.char = this._getCharFromLayout(ev) ?? null;
    return ev;
  }

  private getPengKeyboardEventFromKeyboardEvent(
    e: KeyboardEvent,
    pressed: boolean,
  ): PengKeyboardEvent {
    this.isCapsOn = e.getModifierState("CapsLock");

    const ev = this.getEventFromCode(e.code as KeyCode);
    ev.pressed = pressed;
    return ev;
  }

  public handleEvent(ev: PengKeyboardEvent) {
    // if char not provided attempt to fill it in
    if (!ev.char) {
      ev.char = this._getCharFromLayout(ev) ?? null;
    }
    this._pushEvent(ev);
    if (ev.pressed) {
      this.pressed.add(ev.code);
      this._onKeyTyped(ev);
    } else {
      this.pressed.delete(ev.code);
      if (this.autoRepeatCode === ev.code) {
        this._resetAutorepeat();
      }
    }
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;

    const pengEvent = this.getPengKeyboardEventFromKeyboardEvent(e, true);

    this.handleEvent(pengEvent);
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    const pengEvent = this.getPengKeyboardEventFromKeyboardEvent(e, false);

    this.handleEvent(pengEvent);
  }

  private _resetAutorepeat() {
    this.autoRepeatCode = null;
    this.autoRepeatDelayCounter = this.autoRepeatDelay;
    this.autoRepeatIntervalCounter = 0;
  }

  public printState() {
    console["log"](this.pressed);
  }

  public getIsKeyPressed(keyCode: KeyCode) {
    return this.pressed.has(keyCode);
  }

  private _getCharFromLayout(ev: PengKeyboardEvent) {
    const { code: keyCode, isShiftDown, isCapsOn } = ev;

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

  private _onKeyTyped(ev: PengKeyboardEvent) {
    if (!ev.pressed) return;

    if (ev.code !== this.autoRepeatCode && !getIsModifierKey(ev.code)) {
      this._resetAutorepeat();
      this.autoRepeatCode = ev.code;
    }
  }

  public update(dt: any) {
    if (this.autoRepeatCode) {
      this.autoRepeatDelayCounter -= dt;
      if (this.autoRepeatDelayCounter <= 0) {
        this.autoRepeatIntervalCounter -= dt;
        while (this.autoRepeatIntervalCounter <= 0) {
          this.autoRepeatIntervalCounter += this.autoRepeatInterval;
          const ev = this.getEventFromCode(this.autoRepeatCode);
          ev.pressed = true;
          ev.isAutoRepeat = true;
          this._pushEvent(ev);
          this._onKeyTyped(ev);
        }
      }
    }
  }

  private _pushEvent(ev: PengKeyboardEvent) {
    this.eventBuffer.push(ev);
    this.newEventSignal.emit();
  }

  public flushEventBuffer() {
    this.eventBuffer = [];
  }

  /**
   * Shifts out a single event from the Keyboard event buffer for processing.
   *
   * Returns null if no events available.
   */
  public getNextEvent(): PengKeyboardEvent | null {
    return this.eventBuffer.shift() ?? null;
  }

  /**
   * Shifts out a single event from the Keyboard event buffer for processing.
   *
   * Returns a promise if no events available. The promise will resolve with an event.
   */
  public waitForNextEvent(): PengKeyboardEvent | Promise<PengKeyboardEvent> {
    const immediateEvent = this.eventBuffer.shift();
    if (immediateEvent) {
      return immediateEvent;
    }
    return new Promise((resolve) => {
      const unsub = this.newEventSignal.listen(() => {
        const ev = this.eventBuffer.shift();
        if (ev) {
          unsub();
          resolve(ev);
        }
      });
    });
  }
}
