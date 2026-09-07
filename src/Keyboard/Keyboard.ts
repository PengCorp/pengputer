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
import {
    Modifier,
    type KeyboardSource,
    type KeyCode,
    type PengKeyboardEvent,
} from "./types";
import {
    Signal,
    type SignalListener,
    type SignalUnsubscribe,
} from "@Toolbox/Signal";
import { normalizePastedText, pastedCharToEvent } from "./Paste";

type AnyKeyPressEvent = Pick<
    PengKeyboardEvent,
    "pressed" | "isModifier" | "isAutoRepeat"
>;

const PASTE_CHARACTERS_PER_SECOND = 600;

export class Keyboard implements KeyboardSource {
    private _sources: KeyboardSource[];
    private _eventSignal: Signal<PengKeyboardEvent>;

    private _layout: any;

    /** A bitmask of currently active modifiers. See Modifier for values. */
    private _mods: number = 0;

    private _eventBuffer: PengKeyboardEvent[] = [];

    private _pasteText: string = "";
    private _pasteIndex: number = 0;
    private _pasteCredit: number = 0;

    private _pasteQueue: PengKeyboardEvent[] = [];

    /* Does the event describe a user physically pressing
     * a non-modifier key on his/her keyboard */
    static isRealKeyPress(event: AnyKeyPressEvent): boolean {
        return Keyboard.isCharKeyPress(event) && !event.isAutoRepeat;
    }

    /* Does the event describe a non-modifier key being pressed */
    static isCharKeyPress(event: AnyKeyPressEvent): boolean {
        return event.pressed && !event.isModifier;
    }

    constructor() {
        this._eventSignal = new Signal();
        this._sources = [];
        this._layout = ANSI_LAYOUT;

        this.addSource(this);
    }

    /* KeyboardSource interface functions */
    public onRegister() {}

    public onEvent(e: PengKeyboardEvent) {
        this._eventSignal.emit(e);
    }

    public update(dt: number) {
        for (const src of this._sources) {
            if (src !== this) {
                src.update(dt);
            }
        }

        this._updatePaste(dt);
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
        this._eventBuffer.push(event);

        for (const src of this._sources) {
            if (src && src !== source) src.onEvent(event);
        }
    }

    public getCharFromCode(code: KeyCode): string | null {
        const shift = (this._mods & Modifier.SHIFT) != 0;
        const capsLock = (this._mods & Modifier.CAPS_LOCK) != 0;

        const shiftLayout = this._layout["@shift"];
        const capsLayout = this._layout["@caps"];
        const capsShiftLayout = this._layout["@caps-shift"];

        if (capsLock && capsLayout) {
            if (shift && capsShiftLayout && capsShiftLayout[code]) {
                return capsShiftLayout[code];
            }

            if (capsLayout[code]) {
                return capsLayout[code];
            }
        }

        if (shift && shiftLayout && shiftLayout[code]) {
            return shiftLayout[code];
        }

        if (this._layout[code]) {
            return this._layout[code];
        }

        return null;
    }

    public flushEventBuffer() {
        this._eventBuffer.length = 0;
    }

    /* ===================== PASTING ========================= */

    public pasteText(text: string) {
        const normalized = normalizePastedText(text);
        if (!normalized) return;

        this._pasteText = this._pasteText.slice(this._pasteIndex) + normalized;
        this._pasteIndex = 0;
    }

    /** Is there pasted text still waiting to be delivered or read? */
    public getIsPasting(): boolean {
        return (
            this._pasteIndex < this._pasteText.length ||
            this._pasteQueue.length > 0
        );
    }

    /** Abandons a paste in progress, including anything already queued. */
    public cancelPaste() {
        this._pasteText = "";
        this._pasteIndex = 0;
        this._pasteCredit = 0;
        this._pasteQueue.length = 0;
    }

    private _updatePaste(dt: number) {
        if (this._pasteIndex >= this._pasteText.length) {
            this._pasteCredit = 0;
            return;
        }

        this._pasteCredit += (dt / 1000) * PASTE_CHARACTERS_PER_SECOND;
        let budget = Math.floor(this._pasteCredit);
        if (budget <= 0) return;
        this._pasteCredit -= budget;

        while (budget > 0 && this._pasteIndex < this._pasteText.length) {
            const char = this._pasteText[this._pasteIndex];
            this._pasteIndex += 1;
            budget -= 1;

            const event = pastedCharToEvent(char);
            if (event) this._sendPasteEvent(event);
        }

        if (this._pasteIndex >= this._pasteText.length) {
            this._pasteText = "";
            this._pasteIndex = 0;
        }
    }

    private _sendPasteEvent(event: PengKeyboardEvent) {
        this._pasteQueue.push(event);
        this._eventSignal.emit(event);
    }

    public async waitForNextEvent(): Promise<PengKeyboardEvent> {
        while (true) {
            const event = this.getNextEvent();
            if (event) return event;
            await this._eventSignal.getPromise();
        }
    }

    public subscribe(
        listener: SignalListener<PengKeyboardEvent>,
    ): SignalUnsubscribe {
        return this._eventSignal.listen(listener);
    }

    /**
     * Shifts out a single event, or null if none. Real keystrokes come before
     * pasted ones, so Ctrl+C during a paste is seen promptly.
     */
    public getNextEvent(): PengKeyboardEvent | null {
        return this._eventBuffer.shift() ?? this._pasteQueue.shift() ?? null;
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
