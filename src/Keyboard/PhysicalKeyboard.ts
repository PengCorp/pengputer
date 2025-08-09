/*
 * A class for tracking and reporting state
 * of the physical keyboard.
 */
import { Keyboard, KeyboardSource, Modifier } from "./Keyboard";
import isModifier from "./isModifier";

export class PhysicalKeyboard implements KeyboardSource {
  private kb: Keyboard;

  constructor(kb: Keyboard) {
    this.kb = kb;
  }

  public onRegister() {
    window.addEventListener("keydown", this._onKey.bind(this));
    window.addEventListener("keyup", this._onKey.bind(this));
  }

  public onEvent(event: PengKeyboardEvent) { }
  public update(dt: number) {
    /* TODO: autorepeat here */
  }

  private _constructEventFromBrowser(ev: KeyboardEvent): PengKeyboardEvent {
    return {
      code: ev.code,
      char: this.kb.getCharFromCode(ev.code),
      pressed: ev.type === "keydown",
      isAutoRepeat: false,
      isModifier: isModifier.event(ev),
      ...this.kb.getModifierState()
    };
  }

  private _updateModifierStates(ev: KeyboardEvent) {
    this.kb._mods = (
      0 // <-- balloon
      | (ev.shiftKey ? Modifier.SHIFT   : 0)
      | (ev.ctrlKey  ? Modifier.CONTROL : 0)
      | (ev.altKey   ? Modifier.ALT     : 0)
      | (ev.metaKey  ? Modifier.META    : 0)
      | (ev.getModifierState("CapsLock") ? Modifier.CAPSLK : 0)
    );
  }

  private _onKey(ev: KeyboardEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    this._updateModifierStates(ev);

    // ev = { key: Control, type: "keyup" }
    // this.myHeldMods = CONTROL;
    // kb.mods = CONTROL | ALT;
    // this.kb.setModifierState(~((kb.mods&this.myHeldMods) & Modifier.CONTROL));
    // this.kb.setModifierState(~Modifier.CONTROL);

    if(ev.repeat) return;

    const pengevent = this._constructEventFromBrowser(ev);

    this.kb.sendEvent(this, pengevent);
  }
}
