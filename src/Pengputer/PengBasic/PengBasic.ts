/**
 * PengBASIC -- a Microsoft BASIC compatible interpreter for PengOS.
 *
 * The dialect we are aiming at is the 8K Microsoft BASIC that shipped
 * on the Altair, the PET and the TRS-80: the BASIC that the programs in
 * "BASIC Computer Games" (1978) are written in, plus a few later
 * conveniences (ELSE, WHILE/WEND, PRINT USING, long variable names).
 *
 * This file is currently only the interactive shell -- the loop that
 * prints "Ok", reads a line, and would decide what to do with it. The
 * language itself is built up in stages: tokenizer, expression parser,
 * values and variables, statements and the program store, control flow,
 * input and data, the function library, number formatting, then files.
 *
 * The shape to keep in mind while reading:
 *
 *     a typed line
 *        |
 *        +-- starts with a number?  ->  store it in the program
 *        |                              (that is what "editing" is)
 *        |
 *        +-- otherwise              ->  run it right now
 *                                       (immediate mode)
 *
 * That single rule is why pasting works as a substitute for LOAD: a
 * listing pasted into the prompt is just a hundred lines that each
 * begin with a number, so the interpreter stores them exactly as if
 * they had been typed one at a time.
 */
import type { Executable } from "@FileSystem/fileTypes";
import { type PC } from "../PC";
import { Interpreter } from "./Interpreter";
import { isBasicError } from "./errors";
import { highlightLine } from "./highlight";
import { paletteColor, SYNTAX_COLORS } from "./palette";
import { cgaColor, type Console } from "./console";

/** The PC's keyboard buffer held fifteen characters. Close enough. */
const KEYBOARD_BUFFER = 16;
import { Keyboard } from "@src/Keyboard";
import { waitFor } from "@Toolbox/waitFor";
import { FileTransferManager } from "@Toolbox/FileTransferManager";
import type { Color } from "@Color/Color";

/**
 * The machine, wired to PengOS.
 *
 * The column comes from the real cursor, so PRINT's zones and TAB can
 * never drift out of step with what is on screen.
 */
class StdConsole implements Console {
    private pc: PC;

    private pendingKeys: string[] = [];
    private breakRequested: boolean = false;

    constructor(pc: PC) {
        this.pc = pc;
    }

    write(text: string) {
        this.pc.std.writeConsole(text);
    }

    getColumn(): number {
        return this.pc.std.getConsoleCursorPosition().x;
    }

    getWidth(): number {
        return this.pc.std.getConsoleSize().w;
    }

    getHeight(): number {
        return this.pc.std.getConsoleSize().h;
    }

    async readLine(prompt: string): Promise<string | null> {
        this.pc.std.writeConsole(prompt);
        const line = await this.pc.std.readConsoleLine();
        /* readLine echoed "^C" but not the newline after it. */
        if (line === null) this.pc.std.writeConsole("\n");
        return line;
    }

    /**
     * Empties the keyboard, sorting what it finds.
     *
     * Break checking and INKEY$ both need the same events, and only one
     * of them can consume them -- so neither does. Draining happens
     * here, Ctrl+C is set aside as a break, and everything else waits
     * in a small buffer for INKEY$. Had checkBreak simply discarded
     * what it saw, INKEY$ would almost never catch a key.
     */
    private drainKeyboard() {
        for (;;) {
            const event = this.pc.std.getNextKeyboardEvent();
            if (!event) return;
            if (!Keyboard.isCharKeyPress(event)) continue;

            if (event.isControlDown && event.code === "KeyC") {
                this.breakRequested = true;
                continue;
            }
            if (event.char === null) continue;

            /* The real thing held fifteen and beeped; we quietly drop
             * the excess, which is what a program ignoring INKEY$
             * deserves. */
            if (this.pendingKeys.length < KEYBOARD_BUFFER) {
                this.pendingKeys.push(event.char);
            }
        }
    }

    checkBreak(): boolean {
        this.drainKeyboard();
        const requested = this.breakRequested;
        this.breakRequested = false;
        return requested;
    }

    readKey(): string {
        this.drainKeyboard();
        return this.pendingKeys.shift() ?? "";
    }

    /**
     * Polls rather than calling readConsoleKey, so that the same
     * drain-and-sort sees a Ctrl+C and can report it as a break.
     */
    async waitForKey(): Promise<string> {
        for (;;) {
            const key = this.readKey();
            if (key !== "") return key;
            if (this.breakRequested) {
                this.breakRequested = false;
                return "\x03";
            }
            await waitFor(20);
        }
    }

    clear() {
        this.pc.std.clearConsole();
    }

    locate(row: number, column: number) {
        this.pc.std.setConsoleCursorPosition({ x: column, y: row });
    }

    getCursorRow(): number {
        return this.pc.std.getConsoleCursorPosition().y;
    }

    wait(milliseconds: number): Promise<void> {
        return waitFor(milliseconds);
    }

    setColor(
        foreground: number | null,
        background: number | null,
        blink: boolean | null,
    ) {
        if (foreground !== null) {
            this.pc.std.updateConsoleAttributes({
                fgColor: cgaColor(foreground),
            });
        }
        if (background !== null) {
            this.pc.std.updateConsoleAttributes({
                bgColor: cgaColor(background),
            });
        }
        if (blink !== null) this.pc.std.updateConsoleAttributes({ blink });
    }

    setCursorVisible(visible: boolean) {
        this.pc.std.setIsConsoleCursorVisible(visible);
    }

    getForeground(): Color {
        return this.pc.std.getConsoleAttributes().fgColor;
    }

    setForeground(color: Color) {
        this.pc.std.updateConsoleAttributes({ fgColor: color });
    }

    readCharacter(row: number, column: number): string {
        return this.pc.std.getConsoleCharacterAt({ x: column, y: row });
    }

    download(filename: string, contents: string): Promise<void> {
        return FileTransferManager.presentDownload(contents, filename);
    }

    /** Rejects when the picker is dismissed, which is not an error here. */
    async upload(): Promise<string | null> {
        try {
            const { text } = await FileTransferManager.askForUpload();
            return text;
        } catch {
            return null;
        }
    }
}

/**
 * Reported by the banner. Microsoft BASIC printed the size of the free
 * workspace on startup, and every listing in every book and magazine of
 * the period opens with that line, so we print one too.
 */
const FREE_BYTES = 61440;

export class PengBasic implements Executable {
    private pc: PC;

    private isRunning: boolean = false;

    /** Lines typed at the prompt, for the up-arrow. Not the program. */
    private history: string[] = [];

    private interpreter: Interpreter;

    constructor(pc: PC) {
        this.pc = pc;
        this.interpreter = new Interpreter(new StdConsole(pc));
    }

    async run(args: string[]): Promise<void> {
        const { std } = this.pc;

        this.writeBanner();

        /* TODO(stage 9): `pbasic PROG.BAS' should load and run the
         * program, the way `BASIC PROG' did under MS-DOS. */
        if (args.length > 1) {
            std.writeConsole(
                "?LOADING A PROGRAM FROM A FILE IS NOT DONE YET\n",
            );
        }

        this.isRunning = true;
        while (this.isRunning) {
            /* AUTO and EDIT work by handing the prompt something to
             * start out containing. */
            const prefill = this.interpreter.takePendingPrefill();

            const line = await std.readConsoleLine({
                previousEntries: this.history,
                highlight: this.highlightForPrompt,
                ...(prefill === null ? {} : { initialText: prefill }),
            });

            /* Ctrl+C. readLine printed "^C" but not the newline after
             * it, and in BASIC it abandons the line, not the session.
             * It is also how you leave AUTO. */
            if (line === null) {
                std.writeConsole("\n");
                if (this.interpreter.getIsAuto()) {
                    this.interpreter.cancelAuto();
                } else {
                    this.writeReady();
                }
                continue;
            }

            const trimmed = line.trim();
            if (trimmed.length === 0) {
                /* An offered line number that was left untouched means
                 * the user is done adding lines. */
                if (this.interpreter.getIsAuto()) this.interpreter.cancelAuto();
                continue;
            }

            if (this.history[this.history.length - 1] !== trimmed) {
                this.history.push(trimmed);
            }

            await this.executeLine(trimmed);
        }
    }

    /**
     * Deals with one line from the prompt.
     *
     * "Ok" follows a line the machine *did* something with, and not one
     * it merely filed away -- so typing or pasting a listing scrolls in
     * clean instead of interleaving a hundred of them.
     */
    /**
     * Colors the line being typed, the same way LIST colors a stored
     * one.
     *
     * A line at the prompt has no number in front of it, so this is the
     * bare source -- and it is being typed, so most of the time it is
     * not yet valid. That is what the highlighter's fallback is for: a
     * half-written string simply reads as a string until it is closed.
     */
    private highlightForPrompt = (text: string) =>
        highlightLine(text, (name) => this.interpreter.hasBuiltin(name)).map(
            (span) => ({
                text: span.text,
                color: paletteColor(SYNTAX_COLORS[span.role]),
            }),
        );

    private async executeLine(line: string) {
        const { std } = this.pc;

        const keyword = line.split(/[\s:]+/)[0].toUpperCase();
        switch (keyword) {
            /* SYSTEM is the Microsoft spelling, BYE the DEC one that
             * most home micros copied. Both were common; accept both. */
            case "BYE":
            case "SYSTEM":
            case "EXIT":
                this.isRunning = false;
                return;
        }

        try {
            if ((await this.interpreter.executeLine(line)) === "stored") return;
        } catch (e) {
            if (!isBasicError(e)) throw e;
            std.writeConsole(
                `${e.format(this.interpreter.getRunningLine())}\n`,
            );
        }

        this.writeReady();
    }

    private writeReady() {
        this.pc.std.writeConsole("Ok\n");
    }

    private writeBanner() {
        const { std } = this.pc;

        std.writeConsole("PengBASIC Rev. 1.0\n");
        std.writeConsole("Copyright (C) 1985 PengCorp\n");
        std.writeConsole(` ${FREE_BYTES} Bytes free\n`);
        std.writeConsole("\n");
        std.writeConsole("Type BYE to return to PengOS.\n");
        std.writeConsole("\n");
        this.writeReady();
    }
}
