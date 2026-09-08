import { ANSI_LAYOUT } from "./ansiLayout";
import type { KeyCode, PengKeyboardEvent } from "./types";

/** Which key would have produced this character. Unshifted map wins ties. */
const CHAR_TO_KEY_CODE: Map<string, KeyCode> = (() => {
    const map = new Map<string, KeyCode>();
    const layouts = [
        ANSI_LAYOUT as Record<string, unknown>,
        ANSI_LAYOUT["@shift"] as Record<string, unknown>,
    ];
    for (const layout of layouts) {
        for (const [code, char] of Object.entries(layout)) {
            if (code.startsWith("@")) continue;
            if (typeof char !== "string") continue;
            if (map.has(char)) continue;
            map.set(char, code as KeyCode);
        }
    }
    return map;
})();

/**
 * Clipboard text as the keyboard can deliver it. Tabs become spaces
 * (Tab is autocompletion here) and other control characters are dropped,
 * so a stray ^C in the text cannot pose as a keypress.
 */
export function normalizePastedText(text: string): string {
    return (
        text
            .replace(/\r\n?/g, "\n")
            .replace(/\t/g, " ")
            /* eslint-disable-next-line no-control-regex */
            .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, "")
    );
}

/**
 * One pasted character as a key press. Modifiers are forced off: the paste
 * chord is Ctrl+V, and sampling the live state would make every character
 * arrive as a control chord.
 */
export function pastedCharToEvent(char: string): PengKeyboardEvent | null {
    if (char === "\n") return makeEvent("Enter", "\n");

    /* Characters not on the layout still carry their `char'. */
    const code = CHAR_TO_KEY_CODE.get(char);
    return makeEvent(code ?? "Unidentified", char);
}

function makeEvent(code: KeyCode, char: string): PengKeyboardEvent {
    return {
        code,
        char,
        pressed: true,
        isAutoRepeat: false,
        isModifier: false,
        isShiftDown: false,
        isControlDown: false,
        isAltDown: false,
        isMetaDown: false,
        isCapsOn: false,
    };
}
