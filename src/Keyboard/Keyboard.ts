/* TODO: add comment describing how this works */
import { ANSI_LAYOUT } from "./ansiLayout";
import isModifier from "./isModifier";
import { KeyCode, PengKeyboardEvent } from "./types";
import { Signal } from "../Toolbox/Signal";

export interface KeyboardSource {
  onRegister: () => void;
  onEvent: (event: PengKeyboardEvent) => void;
  update: (dt: number) => void;
};

export enum Modifier {
  SHIFT   = 1<<0,
  CONTROL = 1<<1,
  ALT     = 1<<2,
  META    = 1<<3,
  CAPSLK  = 1<<4,
  ALLMODS = Modifier.SHIFT|Modifier.CONTROL|Modifier.ALT|Modifier.META|Modifier.CAPSLK
}

export class Keyboard implements KeyboardSource {
  private _sources: KeyboardSource[];
  private _eventSig: Signal<PengKeyboardEvent>;

  private _layout: Object;

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
    for(const src of this._sources)
      if(src !== this) src.update(dt);
  }

  /* Keyboard API functions */
  public addSource(src: KeyboardSource) {
    this._sources.push(src);
    src.onRegister();
  }

  public getLayout(): Object {
    return this._layout;
  }

  public getModifierState(): any {
    return {
      isShiftDown:
        (this._mods & Modifier.SHIFT) != 0,
      isControlDown:
        (this._mods & Modifier.CONTROL) != 0,
      isAltDown:
        (this._mods & Modifier.ALT) != 0,
      isMetaDown:
        (this._mods & Modifier.META) != 0,
      isCapsOn:
        (this._mods & Modifier.CAPSLK) != 0,
    }
  }

  public setModifierState(mod: Modifier | number) {
    this._mods &= mod & (Modifier.ALLMODS);
  }

  public sendKeyCode(source: KeyboardSource | null, code: KeyCode, pressed: boolean) {
    const event = this._constructEvent(code, pressed);
    sendEvent(source, event);
  }

  public sendEvent(source: KeyboardSource | null, event: PengKeyboardEvent) {
    for(const src of this._sources) {
      if(src && src !== source) src.onEvent(event);
    }
  }

  public getCharFromCode(code: KeyCode): string {
    /* COPIED (and modified, it's bad ;] ); TODO: rewrite */
    const shift = (this._mods & Modifier.SHIFT) != 0;
    const capslk = (this._mods & Modifier.CAPSLK) != 0;

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

  public flushEventBuffer() {
  }

  public waitForNextEvent(): Promise<PengKeyboardEvent> {
    return this._eventSig.getPromise();
  }

  public getNextEvent() {
    throw new Error("Not implemented; come back next weekend");
  }
}
