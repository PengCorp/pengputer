/**
 * The manual has to keep up with the language.
 *
 * `public/BASIC.html` is hand written, which means it can fall behind
 * the tables it describes. These check the two things that would rot
 * silently: a keyword or function added and never documented, and a
 * `HELP` topic whose anchor does not exist, which would open the page at
 * the top with no sign that anything went wrong.
 *
 * Prose is not checked and cannot be. This only says that every name is
 * mentioned somewhere, which is the difference between a manual that is
 * incomplete and one that is wrong about what exists.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEYWORDS } from "./tokens";
import { createBuiltins } from "./builtins";
import { TestConsole } from "./console";
import { Random } from "./random";
import { MANUAL_PATH, manualUrl } from "./manual";

const MANUAL = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../public/BASIC.html"),
    "utf8",
);

const builtins = createBuiltins({
    machine: new TestConsole(),
    random: new Random(),
    now: () => new Date(),
    lastError: () => ({ code: 0, line: 0 }),
});

/** Names the manual need not mention on their own. */
const PART_OF_SOMETHING_ELSE = new Set([
    /* Second words: END IF, ON ERROR, OPTION BASE, DEF FN, PRINT USING. */
    "THEN",
    "ELSE",
    "TO",
    "STEP",
    "CASE",
    "IS",
    "UNTIL",
    "BASE",
    "FN",
    "USING",
]);

describe("every name is in the manual", () => {
    it("mentions every keyword", () => {
        const missing = Object.keys(KEYWORDS).filter(
            (word) =>
                !PART_OF_SOMETHING_ELSE.has(word) && !MANUAL.includes(word),
        );
        expect(missing).toEqual([]);
    });

    it("mentions every function", () => {
        const missing = [...builtins.keys()].filter(
            (name) => !MANUAL.includes(name),
        );
        expect(missing).toEqual([]);
    });
});

describe("HELP topics land somewhere", () => {
    /** The ids the page offers, which is what a fragment can reach. */
    const anchors = new Set(
        [...MANUAL.matchAll(/id="([^"]+)"/g)].map((m) => m[1]),
    );

    /*
     * `HELP PRINT` opens `BASIC.html#print`, so a topic with no matching
     * id opens the page at the top and looks like nothing happened.
     * Not every name needs its own entry -- SIN shares one with COS --
     * so this checks the ones a person would most likely ask about.
     */
    const asked = [
        "PRINT",
        "INPUT",
        "IF",
        "FOR",
        "WHILE",
        "DO",
        "SELECT",
        "GOSUB",
        "GOTO",
        "DIM",
        "DEF",
        "DATA",
        "COLOR",
        "LOCATE",
        "CLS",
        "LIST",
        "RUN",
        "NEW",
        "EDIT",
        "RENUM",
        "AUTO",
        "DELETE",
        "SWAP",
        "CLEAR",
        "RANDOMIZE",
        "DELAY",
        "DOWNLOAD",
        "HELP",
        "RESUME",
        "ERROR",
        "CONST",
        "OPTION",
        "TRON",
        "LEN",
        "MID$",
        "LEFT$",
        "CHR$",
        "ASC",
        "STR$",
        "VAL",
        "INSTR",
        "STRING$",
        "HEX$",
        "UCASE$",
        "LTRIM$",
        "RND",
        "INT",
        "FIX",
        "SQR",
        "ABS",
        "SGN",
        "EXP",
        "LOG",
        "SIN",
        "CINT",
        "TIMER",
        "INKEY$",
        "SCREEN",
        "POS",
        "TAB",
        "FRE",
        "LBOUND",
    ];

    it("has an anchor for each", () => {
        const missing = asked.filter(
            (topic) => !anchors.has(topic.toLowerCase()),
        );
        expect(missing).toEqual([]);
    });
});

describe("HELP", () => {
    async function run(...lines: string[]) {
        const machine = new TestConsole();
        const { Interpreter } = await import("./Interpreter");
        const interpreter = new Interpreter(machine);
        for (const line of lines) await interpreter.executeLine(line);
        return machine;
    }

    it("asks the host to show the manual", async () => {
        const machine = await run("HELP");
        expect(machine.getHelpRequests()).toEqual([null]);
        expect(machine.getText()).toBe("");
    });

    it("passes a topic along", async () => {
        const machine = await run("HELP PRINT");
        expect(machine.getHelpRequests()).toEqual(["PRINT"]);
    });

    /* A function name is a `name' token where PRINT is a keyword, so
     * both paths have to reach the same place. */
    it("takes a function name too, sigil and all", async () => {
        const machine = await run("HELP LEFT$");
        expect(machine.getHelpRequests()).toEqual(["LEFT$"]);
    });

    /*
     * A browser will refuse to open a window for a program that has
     * been running a while. Saying where the manual is beats failing.
     */
    it("says where to look when the host cannot show it", async () => {
        const machine = new TestConsole();
        machine.setHelpOpens(false);
        const { Interpreter } = await import("./Interpreter");
        await new Interpreter(machine).executeLine("HELP");
        expect(machine.getText()).toBe("SEE BASIC.HTML\n");
    });

    it("refuses a topic that is not a word", async () => {
        await expect(run("HELP 5")).rejects.toThrow(/SYNTAX/);
    });
});

/*
 * The manual's URL is built from the base the app was compiled with,
 * not resolved against the current document. A relative "BASIC.html"
 * lands on `/computer/BASIC.html` from `/computer/` and on
 * `/BASIC.html` from `/computer` -- the same page without the trailing
 * slash. Production redirects the slashless form and hides it; the dev
 * server does not.
 */
describe("where the manual is", () => {
    it("is an absolute path, joined with exactly one slash", () => {
        expect(MANUAL_PATH.startsWith("/")).toBe(true);
        expect(MANUAL_PATH.endsWith("/BASIC.html")).toBe(true);
        expect(MANUAL_PATH).not.toContain("//BASIC");
    });

    it("hangs a topic off it as a fragment", () => {
        expect(manualUrl(null)).toBe(MANUAL_PATH);
        expect(manualUrl("PRINT")).toBe(`${MANUAL_PATH}#print`);
        expect(manualUrl("LEFT$")).toBe(`${MANUAL_PATH}#left$`);
    });
});
