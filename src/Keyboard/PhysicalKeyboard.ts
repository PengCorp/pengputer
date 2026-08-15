import {
    AutoRepeat,
    Keyboard,
    Modifier,
    type KeyboardSource,
    type KeyCode,
    type PengKeyboardEvent,
} from "../Keyboard";
import { getIsEventModifier } from "./isModifier";

/**
 * A class for tracking and reporting state
 * of the physical keyboard.
 */
export class PhysicalKeyboard implements KeyboardSource {
    private kb: Keyboard;

    private autoRepeat: AutoRepeat;

    private _caps: boolean = false;

    /** Codes of the non-modifier keys that are currently held down. */
    private _keysDown: Set<KeyCode> = new Set();

    constructor(kb: Keyboard) {
        this.kb = kb;

        this.autoRepeat = new AutoRepeat(250, 50);
    }

    public onRegister() {
        window.addEventListener("keydown", this._onKey.bind(this));
        window.addEventListener("keyup", this._onKey.bind(this));
        window.addEventListener("blur", this._onWindowBlur.bind(this));
    }

    public onEvent(event: PengKeyboardEvent) {}

    public update(dt: number) {
        if (this.autoRepeat.update(dt)) {
            const code = this.autoRepeat.getCode()!;
            const event = this.kb.constructEvent(code, true);
            event.isAutoRepeat = true;
            this.kb.sendEvent(this, event);
        }
    }

    private _constructEventFromBrowser(ev: KeyboardEvent): PengKeyboardEvent {
        let code = ev.code;
        if (getIsEventModifier(ev)) code = ev.key;
        return {
            code: code,
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
        /* caps lock gets handled separately */
        if (!mod || mod == Modifier.CAPS_LOCK) return;

        if (ev.type === "keydown") {
            this.kb.maskModifiers(mod, Modifier.ALL_MODIFIERS);
        } else {
            this.kb.maskModifiers(0, ~mod);
        }
    }

    private _toggleCaps() {
        this._caps = !this._caps;

        if (this._caps) {
            this.kb.maskModifiers(Modifier.CAPS_LOCK, Modifier.ALL_MODIFIERS);
        } else {
            this.kb.maskModifiers(0, ~Modifier.CAPS_LOCK);
        }
    }

    /*
     * While the window is not focused (a link was opened in a new tab,
     * an <input type="file"> dialog is up, the user alt-tabbed away...)
     * we receive no keyup events, so every key that gets released
     * outside of the window would stay down forever: autorepeat would
     * keep firing it and the modifiers would stay latched.
     */
    private _onWindowBlur() {
        const keysDown = [...this._keysDown];
        this._keysDown.clear();
        this.autoRepeat.reset();

        /* Whatever was typed but not consumed yet is dropped, and the
         * modifiers are cleared before the releases are sent, so that
         * they report the correct state. Caps lock is a toggle rather
         * than a held key, so it is preserved. */
        this.kb.flushEventBuffer();
        this.kb.setModifiers(this._caps ? Modifier.CAPS_LOCK : 0);

        for (const code of keysDown) {
            this.kb.sendKeyCode(this, code, false);
        }
    }

    private _onKey(ev: KeyboardEvent) {
        ev.preventDefault();
        ev.stopPropagation();

        if (ev.repeat) return;

        this._updateModifierStates(ev);

        const pengEvent = this._constructEventFromBrowser(ev);

        if (!pengEvent.isModifier) {
            if (pengEvent.pressed) this._keysDown.add(pengEvent.code);
            else this._keysDown.delete(pengEvent.code);
        }

        if (!pengEvent.pressed) this.autoRepeat.reset();
        else if (pengEvent.isModifier) {
            /* do not send autorepeat for modifiers */
            this.autoRepeat.reset();
            /* browser event handling is really broken */
            if (ev.key == "CapsLock") this._toggleCaps();
        } else this.autoRepeat.setCode(pengEvent.code);

        this.kb.sendEvent(this, pengEvent);
    }
}
