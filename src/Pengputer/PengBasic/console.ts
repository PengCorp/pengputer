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

/**
 * The tertiary hues, in the order they sit in the palette: the six dim
 * ones and then the six bright. Not IBM's -- IBM had no such colors --
 * so no reordering is needed and the numbers run straight.
 */
const TERTIARY_TO_CLASSIC = [
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d,
];

/** How many color numbers there are, counting the blinking ones. */
export const MAX_COLOR_NUMBER = 55;

/** The highest number that names a color rather than a blinking one. */
export const MAX_STEADY_COLOR_NUMBER = 43;

/**
 * THE COLOR NUMBERS
 *
 * ```
 *   0- 15  the CGA sixteen                        black .. white
 *  16- 31  the same, blinking
 *  32- 37  tertiary, dim      orange chartreuse spring azure violet rose
 *  38- 43  tertiary, bright   the same six, light
 *  44- 49  tertiary dim, blinking
 *  50- 55  tertiary bright, blinking
 * ```
 *
 * 0-31 is what a real machine had, blink and all: CGA put the blink flag
 * in the top bit of the foreground attribute, which is why sixteen
 * colors take thirty-two numbers. Everything from 32 up is ours, and it
 * exists because this machine's palette carries twelve colors that
 * IBM's numbering has no way to name (§28 -- the tertiaries were
 * interpolated in OKLCH from the CGA sixteen).
 *
 * A background takes 0-15 or 32-43 only: blink is a property of the
 * foreground, so the blinking numbers name nothing a background can be.
 */
export function cgaColor(index: number): Color {
    if (index >= 32) {
        const tertiary = TERTIARY_TO_CLASSIC[(index - 32) % 12];
        if (tertiary === undefined || index > MAX_COLOR_NUMBER) {
            throw new RangeError(`no such color: ${index}`);
        }
        return classicColors[tertiary];
    }

    const classic = CGA_TO_CLASSIC[index % 16];
    if (classic === undefined || index < 0) {
        throw new RangeError(`no such color: ${index}`);
    }
    return classicColors[classic];
}

/**
 * Whether a color number is one of the blinking ones.
 *
 * The two ranges blink for the same reason and by the same rule -- the
 * upper half of each block -- which is why this is arithmetic rather
 * than a table.
 */
export function cgaBlinks(index: number): boolean {
    return index >= 32 ? index >= 44 : index >= 16;
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

    /**
     * The foreground, as the machine's own color rather than a CGA
     * number.
     *
     * `setColor` above is BASIC's `COLOR` statement and only reaches the
     * first sixteen, because that is all `COLOR` can name. These two are
     * for output the interpreter produces itself -- a colored `LIST` --
     * where the whole 32-color palette is available and the program's
     * own color has to be put back afterwards.
     */
    getForeground(): Color;
    setForeground(color: Color): void;

    /** The character at a cell, for SCREEN(). Both zero-based. */
    readCharacter(row: number, column: number): string;

    /**
     * Shows the manual, at one entry if a topic was named.
     *
     * A host capability like `download' rather than something the
     * interpreter does, because how a manual gets shown is the host's
     * business -- here it is a page in another window, and the port
     * says nothing about that.
     *
     * Answers false if it could not be shown, so `HELP' can say where
     * to look instead. A browser will refuse to open a window for a
     * program that has been running a while, which is exactly when a
     * program might ask.
     */
    showHelp(topic: string | null): boolean;

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
 * Using the real buffer means wrapping, scrolling and cursor behavior
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
    private helpRequests: (string | null)[] = [];
    private helpOpens: boolean = true;
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

    getForeground(): Color {
        return this.buffer.getCurrentAttributes().fgColor;
    }

    setForeground(color: Color) {
        this.buffer.updateCurrentAttributes({ fgColor: color });
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

    showHelp(topic: string | null): boolean {
        this.helpRequests.push(topic);
        return this.helpOpens;
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

    /** The color attributes of one cell, for checking COLOR. */
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

    /** Every topic HELP has asked for, in order. */
    getHelpRequests(): (string | null)[] {
        return this.helpRequests;
    }

    /** Makes the next HELP fail to open, as a blocked popup would. */
    setHelpOpens(opens: boolean) {
        this.helpOpens = opens;
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
