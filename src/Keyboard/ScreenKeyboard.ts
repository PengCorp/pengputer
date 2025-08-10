/*
 * This file tracks, reports and synchronizes the state
 * of the on-screen keyboard.
 */

import {
  Keyboard,
  Modifier,
  type KeyboardSource,
  type KeyCode,
  type PengKeyboardEvent
} from "../Keyboard";
import isModifier from "./isModifier";

export class ScreenKeyboard implements KeyboardSource {
  private kb: Keyboard;

  /* bitmask of Modifier values that this class has set */
  private _ownedMods: number;

  private _special: {
    [Modifier.SHIFT]:   NodeListOf<HTMLSpanElement>,
    [Modifier.CONTROL]: NodeListOf<HTMLSpanElement>,
    [Modifier.ALT]:     NodeListOf<HTMLSpanElement>,
    [Modifier.META]:    NodeListOf<HTMLSpanElement>,
    [Modifier.CAPSLK]:  NodeListOf<HTMLSpanElement>,
  };

  constructor(kb: Keyboard) {
    this.kb = kb;

    this._ownedMods = 0;
    this._special = {
      [Modifier.SHIFT]:  document.querySelectorAll<HTMLSpanElement>(".row span.shift"),
      [Modifier.CONTROL]:document.querySelectorAll<HTMLSpanElement>(".row span.ctrl"),
      [Modifier.ALT]:    document.querySelectorAll<HTMLSpanElement>(".row span.alt"),
      [Modifier.META]:   document.querySelectorAll<HTMLSpanElement>(".row span.meta"),
      [Modifier.CAPSLK]: document.querySelectorAll<HTMLSpanElement>(".row span.capsLock")
    };
  }

  /* KeyboardSource interface functions */
  public onRegister() {
    const allKeys = document.querySelectorAll<HTMLSpanElement>(".row span");
    for(const key of allKeys) {
      const code = key.getAttribute("code");
      if(code && code.length != 0) {
        const func = (ev: MouseEvent) => { this._onKey(code as KeyCode, ev); };
        key.addEventListener("mousedown", func);
        key.addEventListener("mouseup", func);
      }
    }
  }

  public onEvent(event: PengKeyboardEvent) {
    const button = document.querySelector('.row span[code="'+ event.code +'"]');
    if(!button) return;
    if(event.isModifier && !event.pressed) {
      const mod = this.kb.keyCodeToModifier(event.code)!;
      if((this._ownedMods & mod) !== 0) {
        this._toggleModKey(mod);
        this._toggleSetMod(mod);
        return;
      }
    }
    if(event.pressed) {
      button.classList.add("key-down");
    } else {
      button.classList.remove("key-down");
    }
  }

  public update(dt: number) {
    /* TODO: autorepeat here */
  }

  /* private functions */

  /*
   * The on-screen keyboard has lower priority than the user's
   * physical keyboard. The following two functions check, whether
   * the screen keyboard can change a modifier, i.e. if it is not
   * currently set globally or the screen keyboard has already set
   * it to be active, and it is still active. If another source (e.g.
   * the physical keyboard) has set a modifier, and it is not set in
   * our own mask, we must not change its value.
   */
  /* checks whether we already own the modifier's value */
  private _ownModifier(mod: Modifier): boolean {
    return (this._ownedMods & mod) !== 0;
  }

  /* checks whether we can grab control of the modifier's value */
  private _canOwnModifier(mod: Modifier): boolean {
    return (
      this._ownModifier(mod)
      || (this.kb.getModifiers() & mod) === 0
    );
  }

  private _toggleSetMod(mod: Modifier) {
    if((this._ownedMods & mod) != 0) {
      this._ownedMods &= ~mod;
      this.kb.maskModifiers(0, ~mod);
    } else {
      this._ownedMods |= mod;
      this.kb.maskModifiers(mod, Modifier.ALLMODS);
    }
  }

  private _toggleModKey(mod: Modifier) {
    if(mod == Modifier.ALLMODS) return;

    let buttons: NodeListOf<HTMLSpanElement> = this._special[mod];

    for(const button of buttons) {
      button.classList.toggle("key-down")
    }
  }

  private _constructEventFromMouse(code: KeyCode, ev: MouseEvent): PengKeyboardEvent {
    return {
      code: code,
      char: this.kb.getCharFromCode(code),
      pressed: ev.type == "mousedown",
      isAutoRepeat: false,
      isModifier: isModifier.code(code),
      ...this.kb.getModifierState()
    };
  }

  private _onKey(code: KeyCode, ev: MouseEvent) {
    const event = this._constructEventFromMouse(code, ev);

    if(event.isModifier && event.pressed) /* modifier keys are toggle keys */ {
      const mod = this.kb.keyCodeToModifier(code)!;

      if(this._canOwnModifier(mod)) {
        this._toggleModKey(mod);
        this._toggleSetMod(mod);
      }
    }

    this.kb.sendEvent(this, event);
  }
}
