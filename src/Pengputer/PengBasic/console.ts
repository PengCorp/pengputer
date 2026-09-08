/**
 * The machine, as far as PengBASIC is concerned.
 *
 * This was write-only until `INPUT` arrived. It is a port owned by
 * PengBASIC and implemented by PengOS -- never the other way round --
 * so the interpreter never learns what a `Std` is, and every test runs
 * headless against `TestConsole`.
 *
 * `getColumn` exists because PRINT's zones and TAB are column
 * arithmetic; on the real machine it reads the console cursor, so it
 * cannot drift out of step with what is on screen.
 */
import { TextBuffer } from "../../TextBuffer";
import { classicColors } from "@Color/ansi";
import type { Color } from "@Color/Color";
import type { Vector } from "@Toolbox/Vector";

/**
 * COLOR numbers to the machine's palette.
 *
 * BASIC's numbering is IBM's: 1 is blue and 4 is red. The machine's
 * classic palette is in ANSI order, where those two are the other way
 * round, and 3 and 6 swap likewise. Without this table `COLOR 4` would
 * paint things blue.
 */
const CGA_TO_CLASSIC = [0, 4, 2, 6, 1, 5, 3, 7, 8, 12, 10, 14, 9, 13, 11, 15];

export function cgaColor(index: number): Color {
    const classic = CGA_TO_CLASSIC[index];
    if (classic === undefined) throw new RangeError(`no such colour: ${index}`);
    return classicColors[classic];
}

export interface Console {
    write(text: string): void;
    getColumn(): number;
    getWidth(): number;
    getHeight(): number;

    /** A line from the keyboard, or null if the user broke out. */
    readLine(prompt: string): Promise<string | null>;

    /**
     * Has the user asked to stop? Polled between statements, so a
     * runaway program can be interrupted rather than wedging the
     * machine. Must not block.
     */
    checkBreak(): boolean;

    /** A key if one is waiting, "" otherwise. Never blocks: INKEY$. */
    readKey(): string;

    /**
     * Waits for a keypress. Answers "\x03" if the user broke out
     * instead, so a caller can tell "carry on" from "stop".
     */
    waitForKey(): Promise<string>;

    clear(): void;

    /** Both zero-based; BASIC's own numbering starts at 1. */
    locate(row: number, column: number): void;
    getCursorRow(): number;

    /** COLOR numbers, or null to leave that part alone. */
    setColor(
        foreground: number | null,
        background: number | null,
        blink: boolean | null,
    ): void;

    /** LOCATE's third argument: the hardware cursor. */
    setCursorVisible(visible: boolean): void;

    /** The character at a cell, for SCREEN(). Both zero-based. */
    readCharacter(row: number, column: number): string;

    /** Hands the host a file to save. */
    download(filename: string, contents: string): Promise<void>;

    /** Asks the host for a file. Null if the user thought better of it. */
    upload(): Promise<string | null>;

    /**
     * Waits, and lets the host repaint while it does. On the port
     * rather than a bare setTimeout so tests need not actually sleep.
     */
    wait(milliseconds: number): Promise<void>;
}

/**
 * A Console for tests, backed by a **real** TextBuffer -- the same
 * character grid the machine draws to.
 *
 * A plain string would have been simpler, but then column tracking here
 * and column tracking on the real console would be two implementations
 * free to disagree, and everything interesting about PRINT is columns.
 * Using the real buffer means wrapping, scrolling and cursor behaviour
 * are whatever the machine actually does, and tests can ask *where on
 * screen* something landed rather than only what was emitted.
 *
 * Both views are available: `getText()` is the exact byte stream that
 * was written, `getRow()` is what a person would see.
 */
export class TestConsole implements Console {
    private buffer: TextBuffer;
    private stream: string = "";
    private pendingInput: string[] = [];
    private pendingKeys: string[] = [];
    private breaking: boolean = false;
    private waited: number = 0;
    private cursorVisible: boolean = true;
    private downloads: { filename: string; contents: string }[] = [];
    private pendingUploads: string[] = [];

    constructor(width: number = 80, height: number = 25) {
        this.buffer = new TextBuffer({ pageSize: { w: width, h: height } });
    }

    write(text: string) {
        this.stream += text;
        this.buffer.printString(text);
    }

    getColumn(): number {
        return this.buffer.cursor.getPosition().x;
    }

    getWidth(): number {
        return this.buffer.getPageSize().w;
    }

    getHeight(): number {
        return this.buffer.getPageSize().h;
    }

    /**
     * Answers with the next scripted line, echoing it as typing would.
     * Running out returns null -- the same as breaking out -- so a test
     * that forgets to supply enough input stops rather than hanging.
     */
    async readLine(prompt: string): Promise<string | null> {
        this.write(prompt);

        const line = this.pendingInput.shift();
        if (line === undefined) return null;

        this.write(`${line}\n`);
        return line;
    }

    checkBreak(): boolean {
        return this.breaking;
    }

    readKey(): string {
        return this.pendingKeys.shift() ?? "";
    }

    /** Never actually waits, so a test short of keys cannot hang. */
    async waitForKey(): Promise<string> {
        return this.pendingKeys.shift() ?? "";
    }

    clear() {
        this.buffer.eraseScreen();
        this.buffer.cursor.setPosition({ x: 0, y: 0 });
    }

    locate(row: number, column: number) {
        this.buffer.cursor.setPosition({ x: column, y: row });
    }

    getCursorRow(): number {
        return this.buffer.cursor.getPosition().y;
    }

    setColor(
        foreground: number | null,
        background: number | null,
        blink: boolean | null,
    ) {
        if (foreground !== null) {
            this.buffer.updateCurrentAttributes({
                fgColor: cgaColor(foreground),
            });
        }
        if (background !== null) {
            this.buffer.updateCurrentAttributes({
                bgColor: cgaColor(background),
            });
        }
        if (blink !== null) this.buffer.updateCurrentAttributes({ blink });
    }

    setCursorVisible(visible: boolean) {
        this.cursorVisible = visible;
    }

    readCharacter(row: number, column: number): string {
        const cell = this.buffer.getPage(0).lines[row]?.cells[column];
        if (!cell) return " ";
        return cell.rune === "\x00" ? " " : cell.rune;
    }

    /* ---------- for tests ---------- */

    /** Queues what the user will type, in order. */
    provideInput(...lines: string[]) {
        this.pendingInput.push(...lines);
    }

    async download(filename: string, contents: string): Promise<void> {
        this.downloads.push({ filename, contents });
    }

    async upload(): Promise<string | null> {
        return this.pendingUploads.shift() ?? null;
    }

    /** Returns at once, but remembers how long it was asked for. */
    async wait(milliseconds: number): Promise<void> {
        this.waited += milliseconds;
    }

    /** Total milliseconds every DELAY so far asked for. */
    getWaitedMilliseconds(): number {
        return this.waited;
    }

    /** Queues single keys for INKEY$ to find. */
    provideKeys(...keys: string[]) {
        this.pendingKeys.push(...keys);
    }

    /** The colour attributes of one cell, for checking COLOR. */
    getCellColors(
        y: number,
        x: number,
    ): { fg: Color; bg: Color; blink: boolean } | null {
        const cell = this.buffer.getPage(0).lines[y]?.cells[x];
        if (!cell) return null;
        const attributes = cell.getAttributes();
        return {
            fg: attributes.fgColor,
            bg: attributes.bgColor,
            blink: attributes.blink,
        };
    }

    getIsCursorVisible(): boolean {
        return this.cursorVisible;
    }

    /** Everything DOWNLOAD has been asked to save. */
    getDownloads(): { filename: string; contents: string }[] {
        return this.downloads;
    }

    /** Queues file contents for UPLOAD to find; nothing means cancelled. */
    provideUpload(...contents: string[]) {
        this.pendingUploads.push(...contents);
    }

    /** Makes the next break check say yes, as Ctrl+C would. */
    setBreak(breaking: boolean = true) {
        this.breaking = breaking;
    }

    /** Everything written, exactly, including trailing spaces. */
    getText(): string {
        return this.stream;
    }

    /** One row as it appears on screen, trailing blanks removed. */
    getRow(y: number): string {
        const line = this.buffer.getPage(0).lines[y];
        if (!line) return "";
        return line.cells
            .map((cell) => (cell.rune === "\x00" ? " " : cell.rune))
            .join("")
            .trimEnd();
    }

    /** Every row down to the last one with anything on it. */
    getScreen(): string[] {
        const rows: string[] = [];
        for (let y = 0; y < this.buffer.getPageSize().h; y += 1) {
            rows.push(this.getRow(y));
        }
        while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
        return rows;
    }

    getCursor(): Vector {
        return this.buffer.cursor.getPosition();
    }
}
