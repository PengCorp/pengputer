import { Keyboard } from "../Keyboard";
import { type Vector } from "@Toolbox/Vector";
import { TextBuffer } from "../TextBuffer";
import { type KeyCode } from "../Keyboard/types";
import type { Color } from "@Color/Color";

/** A run of the line that should be drawn in one colour. */
export interface ReadLineSpan {
    text: string;
    color: Color;
}

/**
 * Splits the line being typed into coloured runs.
 *
 * A function rather than anything cleverer because `readLine' is used by
 * the shell, the editors and any program that asks a question, and none
 * of them should have to know what the others colour. The one caller
 * that does -- BASIC -- hands its own highlighter in.
 *
 * Supplying one switches the line to being redrawn whole on every
 * keystroke, which it has to be: typing a closing quote changes the
 * colour of everything back to the opening one, so painting only from
 * the cursor onward is not enough. Without a highlighter nothing about
 * the drawing changes.
 */
export type ReadLineHighlighter = (text: string) => ReadLineSpan[];

export interface ReadLineOptions {
    autoCompleteStrings?: string[];
    previousEntries?: string[];
    initialText?: string;
    highlight?: ReadLineHighlighter;
}

class ReadLine {
    private keyboard: Keyboard;
    private buffer: TextBuffer;
    private previousEntries: string[];
    private autoCompleteStrings: string[];

    private isUsingPreviousEntry = false;
    private previousEntryIndex = 0;
    private savedResult = "";
    private result = "";
    private curIndex = 0;

    private highlight: ReadLineHighlighter | null;

    /** Cells the line occupied last time it was drawn, so it can be erased. */
    private painted = 0;

    /** Where the input starts on screen. Only used when highlighting. */
    private start: Vector | null = null;

    constructor(
        keyboard: Keyboard,
        buffer: TextBuffer,
        options: ReadLineOptions = {},
    ) {
        this.keyboard = keyboard;
        this.buffer = buffer;
        this.previousEntries = options.previousEntries ?? [];
        this.autoCompleteStrings = options.autoCompleteStrings ?? [];
        this.result = options.initialText ?? "";
        this.curIndex = this.result.length;
        this.highlight = options.highlight ?? null;

        keyboard.flushEventBuffer();
    }

    /**
     * Paints the whole line again, in colour.
     *
     * Does nothing at all without a highlighter, which is what keeps
     * every other caller of `readLine' drawing exactly as it did.
     *
     * Every movement here is relative to where the cursor actually is,
     * never to a position remembered from earlier. That is what makes it
     * survive both wrapping and scrolling: if printing pushed the screen
     * up, the cursor moved with it, and stepping back the same number of
     * cells still lands on the right character.
     */
    private redraw() {
        if (this.highlight === null) return;
        const { buffer } = this;
        const width = buffer.getPageSize().w;

        /* Where the input begins. Learned once, then re-derived below
         * from where each repaint actually ended, so that a line long
         * enough to scroll the screen corrects itself. */
        if (this.start === null)
            this.start = { ...buffer.cursor.getPosition() };
        buffer.cursor.setPosition({ ...this.start });

        const saved = buffer.getCurrentAttributes().fgColor;
        for (const span of this.highlight(this.result)) {
            buffer.updateCurrentAttributes({ fgColor: span.color });
            buffer.printString(span.text);
        }
        buffer.updateCurrentAttributes({ fgColor: saved });

        /* A line that just got shorter leaves its old tail on screen. */
        const blanks = Math.max(0, this.painted - this.result.length);
        if (blanks > 0) buffer.printString(" ".repeat(blanks));
        this.painted = this.result.length;

        /*
         * Positions are counted in cells from the top of the page rather
         * than as (x, y), because that makes wrapping arithmetic instead
         * of a special case. A cursor resting on the right-hand edge
         * reports the last column with a wrap *pending* rather than the
         * column past it, so its true count is one more.
         */
        const end = buffer.cursor.getPosition();
        const endCell =
            end.y * width + end.x + (buffer.cursor.getIsWrapPending() ? 1 : 0);

        const startCell = Math.max(0, endCell - this.result.length - blanks);
        this.start = { x: startCell % width, y: Math.floor(startCell / width) };

        const caret = startCell + this.curIndex;
        buffer.cursor.setPosition({
            x: caret % width,
            y: Math.floor(caret / width),
        });
    }

    /**
     * Draws, unless the redraw owns the screen.
     *
     * With a highlighter every editing method becomes a pure change to
     * `result' and `curIndex', and `redraw' paints the outcome. Letting
     * both draw would be two things steering one cursor -- and the
     * incremental path clears the wrap-pending flag as it goes, which
     * leaves the cursor's true column ambiguous at exactly the edge of
     * the screen.
     */
    private echo(text: string) {
        if (this.highlight === null) this.buffer.printString(text);
    }

    private moveCursor(delta: Vector) {
        if (this.highlight !== null) return;
        const { buffer } = this;

        const pageSize = buffer.getPageSize();
        const curPos = buffer.cursor.getPosition();
        curPos.x += delta.x;
        curPos.y += delta.y;
        buffer.cursor.setPosition(curPos);
        buffer.cursor.wrapToBeInsidePage(pageSize);
    }

    public run() {
        if (this.result.length > 0) this.echo(this.result);
        this.redraw();

        const promise = new Promise<string | null>(async (resolve) => {
            while (true) {
                const ev = await this.keyboard.waitForNextEvent();

                if (!ev.pressed) continue;

                const key = ev.code;
                const char = ev.char;

                /*
                 * One exit from the dispatch, so the line can be redrawn
                 * after whatever it did. Every branch either leaves
                 * through here or returns outright.
                 */
                dispatch: {
                    if (ev.isControlDown) {
                        if (key === "KeyC") {
                            // Cancel paste in progress
                            this.keyboard.cancelPaste();
                            this.goToEnd();
                            this.buffer.printString("^C");
                            resolve(null);
                            return;
                        } else if (key === "KeyA") {
                            this.goHome();
                        } else if (key === "KeyE") {
                            this.goToEnd();
                        } else if (key === "KeyB") {
                            this.moveBackwards();
                        } else if (key === "KeyF") {
                            this.moveForwards();
                        } else if (key === "KeyD") {
                            this.deleteCharacter();
                        } else if (key === "KeyP") {
                            this.navigateHistoryBackwards();
                        } else if (key === "KeyN") {
                            /* might not work on some browsers, e.g. Firefox */
                            this.navigateHistoryForwards();
                        }

                        break dispatch;
                    }

                    if (ev.isAltDown) {
                        switch (key) {
                            case "KeyB":
                                this.goBackwardsByWord();
                                break dispatch;
                            case "KeyF":
                                this.goForwardsByWord();
                                break dispatch;
                            case "KeyC":
                                this.capitalizeWord();
                                break dispatch;
                            case "KeyL":
                                this.lowercaseWord();
                                break dispatch;
                            case "KeyU":
                                this.uppercaseWord();
                                break dispatch;
                            case "KeyD":
                                this.deleteWord();
                                break dispatch;
                        }

                        break dispatch;
                    }

                    switch (key) {
                        case "Tab":
                            this.tab();
                            break dispatch;
                        case "Home":
                            this.goHome();
                            break dispatch;
                        case "End":
                            this.goToEnd();
                            break dispatch;
                        case "Delete":
                            this.deleteCharacter();
                            break dispatch;
                        case "ArrowLeft":
                            this.moveBackwards();
                            break dispatch;
                        case "ArrowRight":
                            this.moveForwards();
                            break dispatch;
                        case "ArrowUp":
                            this.navigateHistoryBackwards();
                            break dispatch;
                        case "ArrowDown":
                            this.navigateHistoryForwards();
                            break dispatch;
                    }

                    if (char === "\n") {
                        this.buffer.printString(char);
                        resolve(this.result);
                        this.keyboard.flushEventBuffer();
                        return;
                    } else if (char === "\b") {
                        this.backspace();
                    } else if (char) {
                        this.isUsingPreviousEntry = false;
                        const rest = char + this.result.slice(this.curIndex);
                        this.echo(rest);
                        this.moveCursor({ x: -rest.length + 1, y: 0 });
                        this.result =
                            this.result.slice(0, this.curIndex) + rest;
                        this.curIndex += 1;
                    }
                }

                this.redraw();
            }
        });

        return promise;
    }

    private navigateHistoryBackwards() {
        if (this.previousEntries.length > 0) {
            let replaceWith = "";
            if (!this.isUsingPreviousEntry) {
                this.isUsingPreviousEntry = true;
                this.savedResult = this.result;
                this.previousEntryIndex = this.previousEntries.length - 1;
                replaceWith = this.previousEntries[this.previousEntryIndex];
            } else if (this.previousEntryIndex > 0) {
                this.previousEntryIndex -= 1;
                replaceWith = this.previousEntries[this.previousEntryIndex];
            }
            if (replaceWith) {
                this.moveCursor({ x: -this.curIndex, y: 0 });
                this.echo(" ".repeat(this.result.length));
                this.moveCursor({ x: -this.result.length, y: 0 });
                this.echo(replaceWith);
                this.result = replaceWith;
                this.curIndex = replaceWith.length;
            }
        }
    }

    private navigateHistoryForwards() {
        if (
            this.isUsingPreviousEntry &&
            this.previousEntryIndex < this.previousEntries.length
        ) {
            let replaceWith = "";
            this.previousEntryIndex += 1;
            if (this.previousEntryIndex < this.previousEntries.length) {
                replaceWith = this.previousEntries[this.previousEntryIndex];
            } else {
                replaceWith = this.savedResult;
            }
            this.moveCursor({ x: -this.curIndex, y: 0 });
            this.echo(" ".repeat(this.result.length));
            this.moveCursor({ x: -this.result.length, y: 0 });
            this.echo(replaceWith);
            this.result = replaceWith;
            this.curIndex = replaceWith.length;
        }
    }

    private moveForwards() {
        if (this.curIndex < this.result.length) {
            this.curIndex += 1;
            this.moveCursor({ x: 1, y: 0 });
        }
    }

    private moveBackwards() {
        if (this.curIndex > 0) {
            this.curIndex -= 1;
            this.moveCursor({ x: -1, y: 0 });
        }
    }

    private deleteCharacter() {
        if (this.curIndex < this.result.length) {
            this.isUsingPreviousEntry = false;
            const stringStart = this.result.slice(0, this.curIndex);
            const stringEnd = this.result.slice(this.curIndex + 1);
            this.result = stringStart + stringEnd;
            this.echo(stringEnd + " ");
            this.moveCursor({ x: -(stringEnd.length + 1), y: 0 });
        }
    }

    private backspace() {
        if (this.curIndex > 0) {
            this.isUsingPreviousEntry = false;
            const stringStart = this.result.slice(0, this.curIndex - 1);
            const stringEnd = this.result.slice(this.curIndex);
            this.result = stringStart + stringEnd;
            this.curIndex = this.curIndex - 1;
            this.moveCursor({ x: -1, y: 0 });
            this.echo(stringEnd + " ");
            this.moveCursor({ x: -(stringEnd.length + 1), y: 0 });
        }
    }

    private goToEnd() {
        this.moveCursor({
            x: this.result.length - this.curIndex,
            y: 0,
        });
        this.curIndex = this.result.length;
    }

    private goHome() {
        this.moveCursor({ x: -this.curIndex, y: 0 });
        this.curIndex = 0;
    }

    private tab() {
        if (
            this.autoCompleteStrings.length > 0 &&
            this.curIndex === this.result.length
        ) {
            this.isUsingPreviousEntry = false;
            let tokens = this.result.split(" ");
            if (tokens.length === 0) return;
            let token = tokens[tokens.length - 1];
            if (token.length === 0) return;

            const matchingAutoCompleteStrings = this.autoCompleteStrings.filter(
                (s) => s.startsWith(token),
            );

            if (matchingAutoCompleteStrings.length === 1) {
                const autoCompleteString = matchingAutoCompleteStrings[0];
                let prefix = autoCompleteString.slice(0, token.length);
                if (prefix === token) {
                    this.moveCursor({
                        x: -token.length,
                        y: 0,
                    });
                    this.echo(autoCompleteString);
                    this.result =
                        this.result.slice(
                            0,
                            this.result.length - token.length,
                        ) + autoCompleteString;
                    this.curIndex = this.result.length;
                }
            }
        }
    }

    /* word motions */

    private shouldStopWordMotion() {
        const chr = this.result[this.curIndex];
        return chr && !chr.match(/[a-zA-Z0-9]/);
    }

    private goBackwardsByWord() {
        const prevIndex = this.curIndex;

        /* if we are already on a character that stops our motion, skip it */
        // while (--this.curIndex > 0 && this.shouldStopWordMotion());
        do {
            this.curIndex -= 1;
        } while (this.curIndex >= 0 && this.shouldStopWordMotion());

        while (this.curIndex >= 0 && !this.shouldStopWordMotion()) {
            this.curIndex -= 1;
        }

        this.curIndex++; /* move to the start of the word */

        this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
    }

    private goForwardsByWord() {
        const prevIndex = this.curIndex;
        const inputLen = this.result.length;

        /* if we are already on a character that stops our motion, skip it */
        while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
    }

    private capitalizeWord() {
        let prevIndex = this.curIndex;
        const inputLen = this.result.length;

        /* M-c (Alt+C) motion only upcases the first letter
         * it's on, but moves through the whole word. */

        /* move to the first character that can be upcased and upcase that */
        while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        this.moveCursor({ x: this.curIndex - prevIndex, y: 0 });
        prevIndex = this.curIndex;

        while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        if (!this.result[prevIndex]) return; /* at the end of the string */

        const left = this.result.slice(0, prevIndex);
        const middle = this.result[prevIndex].toUpperCase();
        const right = this.result.slice(prevIndex + 1, inputLen);

        this.result = left + middle + right;
        this.echo(middle);

        this.moveCursor({ x: this.curIndex - prevIndex - 1, y: 0 });
    }

    private lowercaseWord() {
        const prevIndex = this.curIndex;
        const inputLen = this.result.length;

        /* if we are already on a character that stops our motion, skip it */
        while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        const left = this.result.slice(0, prevIndex);
        const middle = this.result
            .slice(prevIndex, this.curIndex)
            .toLowerCase();
        const right = this.result.slice(this.curIndex, inputLen);

        this.result = left + middle + right;
        this.echo(middle);
    }

    private uppercaseWord() {
        const prevIndex = this.curIndex;
        const inputLen = this.result.length;

        /* if we are already on a character that stops our motion, skip it */
        while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        const left = this.result.slice(0, prevIndex);
        const middle = this.result
            .slice(prevIndex, this.curIndex)
            .toUpperCase();
        const right = this.result.slice(this.curIndex, inputLen);

        this.result = left + middle + right;
        this.echo(middle);
    }

    private deleteWord() {
        const prevIndex = this.curIndex;
        const inputLen = this.result.length;

        /* if we are already on a character that stops our motion, skip it */
        while (this.curIndex < inputLen && this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        while (this.curIndex < inputLen && !this.shouldStopWordMotion()) {
            this.curIndex++;
        }

        const left = this.result.slice(0, prevIndex);
        // const middle = this.result.slice(prevIndex, this.curIndex); /* this is the part we delete */
        const right = this.result.slice(this.curIndex, inputLen);

        this.echo(right + " ".repeat(this.curIndex - prevIndex));
        this.moveCursor({
            x: prevIndex - inputLen,
            y: 0,
        }); /* printString moves the screen cursor */
        this.result = left + right;
        this.curIndex = prevIndex; /* no movement is needed */
    }
}

export const readLine = async (
    keyboard: Keyboard,
    buffer: TextBuffer,
    options: ReadLineOptions = {},
) => {
    const rl = new ReadLine(keyboard, buffer, options);
    return rl.run();
};

export const readKey = async (
    keyboard: Keyboard,
): Promise<{ char: string | null; key: KeyCode }> => {
    keyboard.flushEventBuffer();
    while (true) {
        const ev = await keyboard.waitForNextEvent();
        if (!Keyboard.isCharKeyPress(ev)) continue;
        return {
            char: ev.char,
            key: ev.code,
        };
    }
};
