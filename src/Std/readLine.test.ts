import { describe, expect, it } from "vitest";
import { Keyboard, Modifier } from "../Keyboard";
import { TextBuffer } from "../TextBuffer";
import { readLine } from "./readLine";
import type { KeyCode } from "../Keyboard/types";

const FRAME_MS = 16;

function harness() {
    const keyboard = new Keyboard();
    const buffer = new TextBuffer({ pageSize: { w: 80, h: 25 } });
    return { keyboard, buffer };
}

/** Lets every pending promise settle. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Runs the animation loop by hand for a while. */
async function runFrames(keyboard: Keyboard, frames: number) {
    for (let i = 0; i < frames; i += 1) {
        keyboard.update(FRAME_MS);
        await settle();
    }
}

async function type(keyboard: Keyboard, ...codes: KeyCode[]) {
    for (const code of codes) {
        keyboard.sendKeyCode(null, code, true);
        await settle();
    }
}

function row(buffer: TextBuffer, y: number): string {
    return buffer
        .getPage(0)
        .lines[y].cells.map((c) => (c.rune === "\x00" ? " " : c.rune))
        .join("")
        .trimEnd();
}

describe("typing", () => {
    it("returns the line on Enter", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer);

        await type(keyboard, "KeyH", "KeyI", "Enter");

        expect(await line).toBe("hi");
    });

    it("echoes what was typed", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer);

        await type(keyboard, "KeyA", "KeyB", "Enter");
        await line;

        expect(row(buffer, 0)).toBe("ab");
    });

    it("backspaces", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer);

        await type(keyboard, "KeyA", "KeyB", "Backspace", "KeyC", "Enter");

        expect(await line).toBe("ac");
    });

    it("returns null on Ctrl+C", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer);

        await type(keyboard, "KeyA");
        keyboard.maskModifiers(Modifier.CONTROL, Modifier.ALL_MODIFIERS);
        await type(keyboard, "KeyC");

        expect(await line).toBe(null);
    });
});

describe("pre-filled text", () => {
    it("starts with the text already there", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer, { initialText: "10 " });

        expect(row(buffer, 0)).toBe("10");

        await type(keyboard, "KeyX", "Enter");
        expect(await line).toBe("10 x");
    });

    it("lets the pre-filled text be edited", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer, { initialText: "abc" });

        await type(keyboard, "Backspace", "KeyZ", "Enter");

        expect(await line).toBe("abz");
    });

    it("can be submitted unchanged", async () => {
        const { keyboard, buffer } = harness();
        const line = readLine(keyboard, buffer, { initialText: "20 PRINT" });

        await type(keyboard, "Enter");

        expect(await line).toBe("20 PRINT");
    });
});

describe("pasting", () => {
    it("delivers a pasted line", async () => {
        const { keyboard, buffer } = harness();
        keyboard.pasteText("HELLO\n");

        const line = readLine(keyboard, buffer);
        await runFrames(keyboard, 10);

        expect(await line).toBe("HELLO");
    });

    /**
     * The flush regression. readLine flushes the event buffer when it
     * starts and again after accepting a line, so a paste spanning
     * several lines used to lose everything after the first.
     */
    it("survives the flush between lines", async () => {
        const { keyboard, buffer } = harness();
        keyboard.pasteText("10 PRINT 1\n20 PRINT 2\n30 END\n");

        const lines: (string | null)[] = [];
        for (let i = 0; i < 3; i += 1) {
            const line = readLine(keyboard, buffer);
            await runFrames(keyboard, 20);
            lines.push(await line);
        }

        expect(lines).toEqual(["10 PRINT 1", "20 PRINT 2", "30 END"]);
    });

    /**
     * The starvation regression. Signal.getPromise() hands out a
     * one-shot listener, so a burst emitted in one frame woke a single
     * waiter and the rest of the burst reached nobody -- delivery was
     * pinned to one character per frame however much was queued.
     */
    it("delivers far more than one character per frame", async () => {
        const { keyboard, buffer } = harness();
        const text = "X".repeat(60);
        keyboard.pasteText(`${text}\n`);

        let result: string | null | undefined;
        void readLine(keyboard, buffer).then((r) => {
            result = r;
        });

        /* 60 characters at 600 a second is about one frame's worth; ten
         * frames is generous. One-per-frame would have managed ten. */
        await runFrames(keyboard, 10);

        expect(result).toBe(text);
    });

    it("stops when the paste is cancelled", async () => {
        const { keyboard, buffer } = harness();
        keyboard.pasteText("AAAA\nBBBB\n");

        const first = readLine(keyboard, buffer);
        await runFrames(keyboard, 10);
        expect(await first).toBe("AAAA");

        keyboard.cancelPaste();

        let second: string | null | undefined;
        void readLine(keyboard, buffer).then((r) => {
            second = r;
        });
        await runFrames(keyboard, 10);

        expect(second).toBeUndefined();
    });

    it("turns tabs into spaces and normalises line endings", async () => {
        const { keyboard, buffer } = harness();
        keyboard.pasteText("A\tBC\r\n");

        const line = readLine(keyboard, buffer);
        await runFrames(keyboard, 10);

        expect(await line).toBe("A BC");
    });
});
