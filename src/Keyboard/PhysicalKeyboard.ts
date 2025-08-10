/*
 * A class for tracking and reporting state
 * of the physical keyboard.
 */
import {
  AutoRepeat,
  Keyboard,
  Modifier,
  type KeyboardSource,
  type KeyCode,
  type PengKeyboardEvent,
} from "../Keyboard";
import { getIsEventModifier } from "./isModifier";

export class PhysicalKeyboard implements KeyboardSource {
  private kb: Keyboard;

  private autorep: AutoRepeat;

  constructor(kb: Keyboard) {
    this.kb = kb;

    this.autorep = new AutoRepeat(150, 50);
  }

  public onRegister() {
    window.addEventListener("keydown", this._onKey.bind(this));
    window.addEventListener("keyup", this._onKey.bind(this));
  }

  public onEvent(event: PengKeyboardEvent) {}
  public update(dt: number) {
    if (this.autorep.update(dt)) {
      const event = this.kb.constructEvent(this.autorep.getCode()!, true);
      event.isAutoRepeat = true;
      this.kb.sendEvent(this, event);
    }
  }

  private _constructEventFromBrowser(ev: KeyboardEvent): PengKeyboardEvent {
    return {
      code: ev.code,
      char: this.kb.getCharFromCode(ev.code as KeyCode),
      pressed: ev.type === "keydown",
      isAutoRepeat: false,
      isModifier: getIsEventModifier(ev),
      ...this.kb.getModifierState(),
    };
  }

  private _eventToModifier(ev: KeyboardEvent): Modifier | null {
    /* The ev.key checking is needed to workaround when user
     * remaps a key, for example CapsLock -> Control; the
     * browser reports the original key (CapsLock) as `ev.code',
     * and the remapped key (Control) as `ev.key'. */
    switch (ev.key) {
      case "Control":
        return Modifier.CONTROL;
      case "Shift":
        return Modifier.SHIFT;
      case "Alt":
        return Modifier.ALT;
      case "Meta":
        return Modifier.META;
      case "CapsLock":
        return Modifier.CAPS_LOCK;
      default: {
        let mod: Modifier | null = this.kb.keyCodeToModifier(
          ev.code as KeyCode,
        );
        return mod;
      }
    }
  }

  private _updateModifierStates(ev: KeyboardEvent) {
    const mod = this._eventToModifier(ev);
    if (!mod) return;

    if (ev.type === "keydown") {
      this.kb.maskModifiers(mod, Modifier.ALL_MODIFIERS);
    } else {
      this.kb.maskModifiers(0, ~mod);
    }
  }

  private _onKey(ev: KeyboardEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.repeat) return;

    this._updateModifierStates(ev);

    const pengevent = this._constructEventFromBrowser(ev);

    if (pengevent.pressed) {
      this.autorep.setCode(pengevent.code);
    } else this.autorep.reset();

    this.kb.sendEvent(this, pengevent);
  }
}
