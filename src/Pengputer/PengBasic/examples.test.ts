/**
 * Every listing in examples/ is run and its output checked.
 *
 * They exist to be pasted into pbasic by hand, which makes them the
 * kind of thing that rots silently. Running them here means a listing
 * that stops working fails the suite instead of failing a person.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

const EXAMPLES_DIR = join(dirname(fileURLToPath(import.meta.url)), "examples");

/** Every line ends in a number followed by its trailing space. */
const EXPECTED: Record<string, string | RegExp> = {
    "squares.bas": " 1  1 \n 2  4 \n",

    "table.bas":
        " 1  2  3  4  5 \n" +
        " 2  4  6  8  10 \n" +
        " 3  6  9  12  15 \n" +
        " 4  8  12  16  20 \n" +
        " 5  10  15  20  25 \n",

    "triangle.bas": "*\n**\n***\n****\n*****\n",

    "fib.bas": " 0  1  1  2  3  5  8  13  21  34 \n",

    "gosub.bas": " 10  10 \n 20  20 \n 30  30 \n",

    "powers.bas": " 1  2  4  8  16  32  64 \n",

    "sort.bas": " 1  3  5  8  9 \n",

    "ifelse.bas":
        " 1 SMALL\n" +
        " 2 SMALL\n" +
        " 3 SMALL\n" +
        " 4 BIG\n" +
        " 5 BIG\n" +
        " 6 BIG\n",

    "menu.bas": "ONE\nTWO\nTHREE\nNONE OF THE ABOVE\n",

    "greet.bas":
        "WHAT IS YOUR NAME? PENGER\n" +
        "HOW MANY TIMES? 2\n" +
        "HELLO, PENGER\n" +
        "HELLO, PENGER\n",

    "months.bas":
        "JANUARY HAS 31 DAYS\n" +
        "FEBRUARY HAS 28 DAYS\n" +
        "MARCH HAS 31 DAYS\n" +
        "APRIL HAS 30 DAYS\n" +
        "BACK TO JANUARY\n",

    "deffn.bas":
        " 32 F IS 0 C\n" +
        " 77 F IS 25 C\n" +
        " 122 F IS 50 C\n" +
        " 167 F IS 75 C\n" +
        " 212 F IS 100 C\n",

    "strings.bas":
        "LENGTH IS 7 \n" +
        "PENG/GUI/UIN\n" +
        "GUI IS AT 4 \n" +
        "-------\n" +
        "PENGUIN\n",

    "invoice.bas":
        "WIDGET  12   $1,234.50\n" +
        "GIZMO    3      $99.95\n" +
        "TOTAL           $1,334.45\n",

    /* The number depends on the generator, which is pinned by its own
     * tests rather than by this one. */
    "guess.bas": /^(YOUR GUESS\? \d+\n(TOO LOW|TOO HIGH)\n){6}OUT OF TRIES\. IT WAS \d+ \n$/,

    /* Screen listings are about *where* things land, so they are
     * checked by position in Screen.test.ts rather than by their
     * stream of bytes. Here they only have to run. */
    "colors.bas": /COLOUR 15 {2}/,
    "bounce.bas": /STOPPED\n$/,
};

/** Lines the reader would type, for listings that ask questions. */
const INPUTS: Record<string, string[]> = {
    "greet.bas": ["PENGER", "2"],
    "guess.bas": ["50", "25", "37", "31", "34", "32"],
};

/** Keys the reader would press, for listings that watch for one. */
const KEYS: Record<string, string[]> = {
    "bounce.bas": [" "],
};

function listingNames(): string[] {
    return readdirSync(EXAMPLES_DIR)
        .filter((name) => name.endsWith(".bas"))
        .sort();
}

function read(name: string): string {
    return readFileSync(join(EXAMPLES_DIR, name), "utf8");
}

/** Pastes a listing, then does what the reader would: types RUN. */
async function pasteAndRun(
    source: string,
    input: string[] = [],
    keys: string[] = [],
): Promise<string> {
    const machine = new TestConsole();
    machine.provideInput(...input);
    machine.provideKeys(...keys);
    const interpreter = new Interpreter(machine);
    for (const line of source.split("\n")) {
        if (line.trim().length === 0) continue;
        await interpreter.executeLine(line);
    }
    expect(machine.getText()).toBe("");
    await interpreter.executeLine("RUN");
    return machine.getText();
}

describe("examples", () => {
    it("all have an expected output recorded here", () => {
        expect(listingNames()).toEqual(Object.keys(EXPECTED).sort());
    });

    /**
     * Without the final newline the last line of a paste is left
     * sitting at the cursor unsubmitted -- and the last line is always
     * RUN, so the program would look like it did nothing.
     */
    it("all end with a trailing newline", () => {
        for (const name of listingNames()) {
            expect(read(name).endsWith("\n"), name).toBe(true);
        }
    });

    /* Pasting a listing should leave you with a program, not run one. */
    it("none of them runs itself", () => {
        for (const name of listingNames()) {
            expect(read(name).toUpperCase().split(/\s+/), name).not.toContain("RUN");
        }
    });

    for (const [name, expected] of Object.entries(EXPECTED)) {
        it(`${name} produces its expected output`, async () => {
            const actual = await pasteAndRun(
                read(name),
                INPUTS[name] ?? [],
                KEYS[name] ?? [],
            );
            if (expected instanceof RegExp) expect(actual).toMatch(expected);
            else expect(actual).toBe(expected);
        });
    }
});
