/*
 * The core keyboard class.
 * The Keyboard class manages the global keyboard state.
 * It, by itself, does not track any events, instead an
 * 'event source' (KeyboardSource) may be registered
 * (using Keyboard.addSource) to detect and broadcast events
 * that occur within the source. There may be multiple sources
 * at once, at the moment of writing there are two: PhysicalKeyboard
 * and ScreenKeyboard. The former tracks the state of the physical
 * keyboard of the user, the latter tracks the on-screen keyboard,
 * located below the display of the current screen of the PengPuter.
 *
 * To understand everything else, read the respective files for
 * PhysicalKeyboard and ScreenKeyboard.
 */
import { ANSI_LAYOUT } from "./ansiLayout";
import { getIsCodeModifier } from "./isModifier";
import { Modifier, type KeyCode, type PengKeyboardEvent } from "./types";
import { Signal } from "@Toolbox/Signal";

export interface KeyboardSource {
  onRegister: () => void;
  onEvent: (event: PengKeyboardEvent) => void;
  update: (dt: number) => void;
}

export class Keyboard implements KeyboardSource {
  private _sources: KeyboardSource[];
  private _eventSig: Signal<PengKeyboardEvent>;

  private _layout: any;

  /* a bitmask of currently active modifiers */
  private _mods: number = 0;

  constructor() {
    this._eventSig = new Signal();
    this._sources = [];
    this._layout = ANSI_LAYOUT;

    this.addSource(this);
  }

  /* KeyboardSource interface functions */
  public onRegister() {}

  public onEvent(e: PengKeyboardEvent) {
    this._eventSig.emit(e);
  }

  public update(dt: number) {
    for (const src of this._sources) if (src !== this) src.update(dt);
  }

  /* Keyboard API functions */
  public addSource(src: KeyboardSource) {
    this._sources.push(src);
    src.onRegister();
  }

  public getLayout(): any {
    return this._layout;
  }

  public keyCodeToModifier(code: KeyCode): Modifier | null {
    switch (code) {
      case "ShiftLeft":
      case "ShiftRight":
        return Modifier.SHIFT;
      case "ControlLeft":
      case "ControlRight":
        return Modifier.CONTROL;
      case "AltLeft":
      case "AltRight":
        return Modifier.ALT;
      case "MetaLeft":
      case "MetaRight":
        return Modifier.META;
      case "CapsLock":
        return Modifier.CAPS_LOCK;
      default:
        return null;
    }
  }

  public getModifierState(): any {
    return {
      isShiftDown: (this._mods & Modifier.SHIFT) != 0,
      isControlDown: (this._mods & Modifier.CONTROL) != 0,
      isAltDown: (this._mods & Modifier.ALT) != 0,
      isMetaDown: (this._mods & Modifier.META) != 0,
      isCapsOn: (this._mods & Modifier.CAPS_LOCK) != 0,
    };
  }

  public setModifiers(mod: number) {
    this._mods = mod & Modifier.ALL_MODIFIERS;
  }

  public maskModifiers(ORMask: number, ANDMask: number) {
    this._mods |= ORMask;
    this._mods &= ANDMask;
  }

  public getModifiers(): number {
    return this._mods;
  }

  public sendKeyCode(
    source: KeyboardSource | null,
    code: KeyCode,
    pressed: boolean,
  ) {
    const event = this.constructEvent(code, pressed);
    this.sendEvent(source, event);
  }

  public sendEvent(source: KeyboardSource | null, event: PengKeyboardEvent) {
    for (const src of this._sources) {
      if (src && src !== source) src.onEvent(event);
    }
  }

  public getCharFromCode(code: KeyCode): string | null {
    /* COPIED (and modified, it's bad ;] ); TODO: rewrite */
    const shift = (this._mods & Modifier.SHIFT) != 0;
    const capslk = (this._mods & Modifier.CAPS_LOCK) != 0;

    const shiftLayout = this._layout["@shift"];
    const capsLayout = this._layout["@caps"];
    const capsShiftLayout = this._layout["@caps-shift"];

    if (capslk && capsLayout) {
      if (shift && capsShiftLayout && capsShiftLayout[code]) {
        return capsShiftLayout[code];
      }

      if (capsLayout[code]) {
        return capsLayout[code];
      }
    }

    if (shift) {
      if (shiftLayout && shiftLayout[code]) {
        return shiftLayout[code];
      }
      return null;
    }

    if (this._layout[code]) {
      return this._layout[code];
    }

    return null;
  }

  public flushEventBuffer() {}

  public waitForNextEvent(): Promise<PengKeyboardEvent> {
    return this._eventSig.getPromise();
  }

  public getNextEvent(): PengKeyboardEvent | null | never {
    throw new Error("Not implemented; come back next weekend");
  }

  public constructEvent(code: KeyCode, pressed: boolean): PengKeyboardEvent {
    return {
      code: code,
      char: this.getCharFromCode(code),
      pressed: pressed,
      isAutoRepeat: false,
      isModifier: getIsCodeModifier(code),
      ...this.getModifierState(),
    };
  }
}
