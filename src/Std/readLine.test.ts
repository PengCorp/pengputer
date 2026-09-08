/**
 * Typing at a colored prompt.
 *
 * `readLine` is shared by the shell, the editors and any program that
 * asks a question, so the first thing these check is that supplying no
 * highlighter changes nothing at all.
 *
 * Driven through the real `TextBuffer` and `Keyboard` -- both are pure
 * data with no DOM -- so what is asserted is what the screen would show.
 */
import { describe, expect, it } from "vitest";
import { Keyboard } from "../Keyboard";
import { TextBuffer } from "../TextBuffer";
import { readLine, type ReadLineSpan } from "./readLine";
import { classicColors } from "@Color/ansi";
import { ColorType } from "@Color/Color";

const RED = classicColors["lightRed"];
const YELLOW = classicColors["lightYellow"];

/** The palette index of a color we know to be a classic one. */
const indexOf = (color: typeof RED) =>
    color.type === ColorType.Classic ? color.index : null;
const RED_INDEX = indexOf(RED);
const YELLOW_INDEX = indexOf(YELLOW);

function machine() {
    const keyboard = new Keyboard();
    const buffer = new TextBuffer({ pageSize: { w: 20, h: 5 } });
    return { keyboard, buffer };
}

/** Types the characters, then Enter, letting each be consumed. */
async function type(keyboard: Keyboard, text: string) {
    for (const char of text) {
        keyboard.sendEvent(null, {
            code: "KeyA",
            char,
            pressed: true,
            isAutoRepeat: false,
            isModifier: false,
            isShiftDown: false,
            isControlDown: false,
            isAltDown: false,
            isMetaDown: false,
            isCapsOn: false,
        });
        await Promise.resolve();
    }
}

/** One row as it appears, trailing blanks removed. */
function row(buffer: TextBuffer, y: number) {
    return buffer
        .getPage(0)
        .lines[y].cells.map((c) => (c.rune === "\x00" ? " " : c.rune))
        .join("")
        .trimEnd();
}

/** The palette index of one cell, or null if it is not a classic color. */
function colorAt(buffer: TextBuffer, y: number, x: number) {
    const fg = buffer.getPage(0).lines[y].cells[x].getAttributes().fgColor;
    return fg.type === ColorType.Classic ? fg.index : null;
}

/** Everything before "A" is red; "A" onward is yellow. */
const splitAtA = (text: string): ReadLineSpan[] => {
    const at = text.indexOf("A");
    if (at < 0) return text ? [{ text, color: RED }] : [];
    return [
        ...(at > 0 ? [{ text: text.slice(0, at), color: RED }] : []),
        { text: text.slice(at), color: YELLOW },
    ];
};

describe("without a highlighter", () => {
    it("draws exactly what was typed", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer);
        await type(keyboard, "PRINT 1\n");
        expect(await line).toBe("PRINT 1");
        expect(row(buffer, 0)).toBe("PRINT 1");
    });

    it("leaves the color alone", async () => {
        const { keyboard, buffer } = machine();
        const before = buffer.getCurrentAttributes().fgColor;
        const line = readLine(keyboard, buffer);
        await type(keyboard, "AB\n");
        await line;
        expect(buffer.getCurrentAttributes().fgColor).toEqual(before);
        expect(colorAt(buffer, 0, 0)).toBe(colorAt(buffer, 0, 1));
    });
});

describe("with a highlighter", () => {
    it("colors as it goes", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer, { highlight: splitAtA });
        await type(keyboard, "XYA\n");
        expect(await line).toBe("XYA");

        expect(row(buffer, 0)).toBe("XYA");
        expect(colorAt(buffer, 0, 0)).toBe(RED_INDEX);
        expect(colorAt(buffer, 0, 1)).toBe(RED_INDEX);
        expect(colorAt(buffer, 0, 2)).toBe(YELLOW_INDEX);
    });

    /*
     * The point of redrawing the whole line rather than painting from
     * the cursor: a character typed at the end can change the color of
     * everything before it, exactly as a closing quote does.
     */
    it("recolors what was already on screen", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer, { highlight: splitAtA });

        await type(keyboard, "XY");
        expect(colorAt(buffer, 0, 0)).toBe(RED_INDEX);

        /* Inserting A before them turns X and Y yellow. */
        await type(keyboard, "\b\b");
        await type(keyboard, "AXY\n");
        await line;

        expect(row(buffer, 0)).toBe("AXY");
        expect(colorAt(buffer, 0, 0)).toBe(YELLOW_INDEX);
        expect(colorAt(buffer, 0, 1)).toBe(YELLOW_INDEX);
    });

    it("erases the tail when the line gets shorter", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer, { highlight: splitAtA });
        await type(keyboard, "XXXXXX");
        await type(keyboard, "\b\b\b\b");
        await type(keyboard, "\n");
        expect(await line).toBe("XX");
        expect(row(buffer, 0)).toBe("XX");
    });

    it("puts the color back for whatever prints next", async () => {
        const { keyboard, buffer } = machine();
        const before = buffer.getCurrentAttributes().fgColor;
        const line = readLine(keyboard, buffer, { highlight: splitAtA });
        await type(keyboard, "XA\n");
        await line;
        expect(buffer.getCurrentAttributes().fgColor).toEqual(before);
    });

    /* Movement is relative to where the cursor is, so a line that wraps
     * onto the next row still repaints correctly. */
    it("survives a line that wraps", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer, { highlight: splitAtA });
        await type(keyboard, "XXXXXXXXXXXXXXXXXXXXXXXXA\n");
        expect(await line).toBe("XXXXXXXXXXXXXXXXXXXXXXXXA");

        expect(row(buffer, 0)).toBe("XXXXXXXXXXXXXXXXXXXX");
        expect(row(buffer, 1)).toBe("XXXXA");
        expect(colorAt(buffer, 1, 4)).toBe(YELLOW_INDEX);
    });

    it("keeps an initial text and colors it", async () => {
        const { keyboard, buffer } = machine();
        const line = readLine(keyboard, buffer, {
            highlight: splitAtA,
            initialText: "AB",
        });
        await type(keyboard, "\n");
        expect(await line).toBe("AB");
        expect(colorAt(buffer, 0, 0)).toBe(YELLOW_INDEX);
    });
});
