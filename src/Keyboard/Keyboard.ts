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
  private _pressed: Set<KeyCode>;
  private _layout: any;

  private _autoRepeatDelay: number;
  private _autoRepeatDelayCounter: number;
  private _autoRepeatInterval: number;
  private _autoRepeatIntervalCounter: number;
  private _autoRepeatCode: KeyCode | null;

  private _eventBuffer: PengKeyboardEvent[] = [];

  private _newEventSignal: Signal<void> = new Signal();

  private _isCapsOn: boolean = false;

  public forceShift: boolean = false;
  public forceControl: boolean = false;
  public forceAlt: boolean = false;
  public forceMeta: boolean = false;
  public forceCaps: boolean = false;

  constructor() {
    this._pressed = new Set();
    this._layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this._autoRepeatDelay = 250;
    this._autoRepeatDelayCounter = this._autoRepeatDelay;
    this._autoRepeatInterval = 50;
    this._autoRepeatIntervalCounter = this._autoRepeatInterval;
    this._autoRepeatCode = null;
  }

  private _getModifiersState() {
    return {
      isShiftDown:
        this.forceShift ||
        this._pressed.has("ShiftLeft") ||
        this._pressed.has("ShiftRight"),
      isControlDown:
        this.forceControl ||
        this._pressed.has("ControlLeft") ||
        this._pressed.has("ControlRight"),
      isAltDown:
        this.forceAlt ||
        this._pressed.has("AltLeft") ||
        this._pressed.has("AltRight"),
      isMetaDown:
        this.forceMeta ||
        this._pressed.has("MetaLeft") ||
        this._pressed.has("MetaRight"),
      isCapsOn: this.forceCaps || this._isCapsOn,
    };
  }

  private _getEventFromCode(kc: KeyCode): PengKeyboardEvent {
    const ev: PengKeyboardEvent = {
      code: kc,
      char: null,
      pressed: false,
      isAutoRepeat: false,
      ...this._getModifiersState(),
      isModifier: getIsModifierKey(kc),
    };
    ev.char = this._getCharFromLayout(ev) ?? null;
    return ev;
  }

  private _getPengKeyboardEventFromKeyboardEvent(
    e: KeyboardEvent,
    pressed: boolean,
  ): PengKeyboardEvent {
    this._isCapsOn = e.getModifierState("CapsLock");

    const ev = this._getEventFromCode(e.code as KeyCode);
    ev.pressed = pressed;
    return ev;
  }

  public handleKeyCode(kc: KeyCode, pressed: boolean) {
    const ev = this._getEventFromCode(kc);
    ev.pressed = pressed;
    this._handleEvent(ev);
  }

  private _handleEvent(ev: PengKeyboardEvent) {
    // if char not provided attempt to fill it in
    if (!ev.char) {
      ev.char = this._getCharFromLayout(ev) ?? null;
    }
    this._pushEvent(ev);
    if (ev.pressed) {
      this._pressed.add(ev.code);
      this._onKeyTyped(ev);
    } else {
      this._pressed.delete(ev.code);
      if (this._autoRepeatCode === ev.code) {
        this._resetAutorepeat();
      }
    }
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;

    const pengEvent = this._getPengKeyboardEventFromKeyboardEvent(e, true);

    this._handleEvent(pengEvent);
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    const pengEvent = this._getPengKeyboardEventFromKeyboardEvent(e, false);

    this._handleEvent(pengEvent);
  }

  private _resetAutorepeat() {
    this._autoRepeatCode = null;
    this._autoRepeatDelayCounter = this._autoRepeatDelay;
    this._autoRepeatIntervalCounter = 0;
  }

  public printState() {
    console["log"](this._pressed);
  }

  public getIsKeyPressed(keyCode: KeyCode) {
    return this._pressed.has(keyCode);
  }

  private _getCharFromLayout(ev: PengKeyboardEvent) {
    const { code: keyCode, isShiftDown, isCapsOn } = ev;

    const shiftLayout = this._layout["@shift"];
    const capsLayout = this._layout["@caps"];
    const capsShiftLayout = this._layout["@caps-shift"];

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

    if (this._layout[keyCode]) {
      return this._layout[keyCode];
    }

    return null;
  }

  private _onKeyTyped(ev: PengKeyboardEvent) {
    if (!ev.pressed) return;

    if (ev.code !== this._autoRepeatCode && !getIsModifierKey(ev.code)) {
      this._resetAutorepeat();
      this._autoRepeatCode = ev.code;
    }
  }

  public update(dt: any) {
    if (this._autoRepeatCode) {
      this._autoRepeatDelayCounter -= dt;
      if (this._autoRepeatDelayCounter <= 0) {
        this._autoRepeatIntervalCounter -= dt;
        while (this._autoRepeatIntervalCounter <= 0) {
          this._autoRepeatIntervalCounter += this._autoRepeatInterval;
          const ev = this._getEventFromCode(this._autoRepeatCode);
          ev.pressed = true;
          ev.isAutoRepeat = true;
          this._pushEvent(ev);
          this._onKeyTyped(ev);
        }
      }
    }
  }

  private _pushEvent(ev: PengKeyboardEvent) {
    this._eventBuffer.push(ev);
    this._newEventSignal.emit();
  }

  public flushEventBuffer() {
    this._resetAutorepeat();
    this._eventBuffer = [];
  }

  /**
   * Shifts out a single event from the Keyboard event buffer for processing.
   *
   * Returns null if no events available.
   */
  public getNextEvent(): PengKeyboardEvent | null {
    return this._eventBuffer.shift() ?? null;
  }

  /**
   * Shifts out a single event from the Keyboard event buffer for processing.
   *
   * Returns a promise if no events available. The promise will resolve with an event.
   */
  public waitForNextEvent(): PengKeyboardEvent | Promise<PengKeyboardEvent> {
    const immediateEvent = this._eventBuffer.shift();
    if (immediateEvent) {
      return immediateEvent;
    }
    return new Promise((resolve) => {
      const unsub = this._newEventSignal.listen(() => {
        const ev = this._eventBuffer.shift();
        if (ev) {
          unsub();
          resolve(ev);
        }
      });
    });
  }
}
