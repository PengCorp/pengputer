/**
 * Coloring a listing.
 *
 * The load-bearing property is the first describe block: the spans
 * always rejoin to exactly the source they came from. `LIST` promises to
 * show a program back the way it was typed, so a highlighter that
 * reformats anything -- even one space -- has broken the statement it is
 * decorating.
 */
import { describe, expect, it } from "vitest";
import { highlightLine } from "./highlight";
import { createBuiltins } from "./builtins";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { Random } from "./random";
import { SYNTAX_COLORS } from "./palette";
import { classicColors } from "@Color/ansi";

const builtins = createBuiltins({
    machine: new TestConsole(),
    random: new Random(),
    now: () => new Date(),
    lastError: () => ({ code: 0, line: 0 }),
});
const isBuiltin = (name: string) => builtins.has(name);

/** "role:text" pairs, for readable assertions. */
const roles = (source: string) =>
    highlightLine(source, isBuiltin).map((s) => `${s.role}:${s.text}`);

const SOURCES = [
    "PRINT 1",
    "10   PRINT    1",
    "  ",
    "",
    "REM  two spaces after REM",
    "DATA 1 , 2",
    "DATA   95,72,   -1,HELLO",
    'DATA "A,B",3',
    "A$ = LEFT$(N$, 3) + FNG$(X)",
    "IF ERR<>11 THEN ON ERROR GOTO 0",
    "FOR I = 1 TO 10 STEP .5",
    'PRINT "unterminated',
    "SELECT CASE S: CASE IS >= 90: END SELECT",
];

describe("the source survives exactly", () => {
    it("rejoins to what it was given", () => {
        for (const source of SOURCES) {
            const joined = highlightLine(source, isBuiltin)
                .map((span) => span.text)
                .join("");
            expect(joined, JSON.stringify(source)).toBe(source);
        }
    });

    it("never emits an empty span", () => {
        for (const source of SOURCES) {
            for (const span of highlightLine(source, isBuiltin)) {
                expect(span.text.length).toBeGreaterThan(0);
            }
        }
    });
});

describe("roles", () => {
    it("colors a whole control statement as control flow", () => {
        expect(roles("IF A<>1 THEN 20")).toEqual([
            "controlFlow:IF",
            "text: A",
            "operator:<>",
            "number:1",
            "text: ",
            "controlFlow:THEN",
            "text: ",
            "number:20",
        ]);
    });

    /*
     * Three kinds of keyword, and which one a word is comes from the
     * keyword table rather than from a list kept in the highlighter --
     * so adding a keyword classifies it in the same breath as defining
     * it, and the two cannot disagree.
     */
    it("tells control flow from declarations from commands", () => {
        expect(roles("FOR I=1 TO 3")[0]).toBe("controlFlow:FOR");
        expect(roles("DIM A(5)")[0]).toBe("keyword:DIM");
        expect(roles("CLS")[0]).toBe("builtin:CLS");
    });

    /* A statement the machine supplies sits with the functions it
     * supplies: to a reader both are simply "already here". */
    it("colors PRINT as a built-in, like LEN", () => {
        expect(roles("PRINT 1")[0]).toBe("builtin:PRINT");
        expect(roles("A=LEN(B$)")).toContain("builtin:LEN");
    });

    it("keeps strings whole, quotes included", () => {
        expect(roles('PRINT "HI, THERE"')).toEqual([
            "builtin:PRINT",
            "text: ",
            'string:"HI, THERE"',
        ]);
    });

    /*
     * The distinction a listing gives you no other clue about: LEFT$ and
     * FNG$ are both spelled NAME(...), and only the built-in table says
     * which is which.
     */
    it("tells a supplied function from one the program defined", () => {
        const spans = roles("A=LEFT$(B$,1)+FNG$(C)");
        expect(spans).toContain("builtin:LEFT$");
        expect(spans).toContain("function:FNG$");
    });

    it("leaves ordinary variables as plain text", () => {
        expect(roles("ZZ=1")).toEqual(["text:ZZ", "operator:=", "number:1"]);
    });

    /* DEFINT declares, so it reads as a declaration rather than as a
     * category of its own. The `type' role is defined and unused. */
    it("treats the type declarations as declarations", () => {
        expect(roles("DEFINT A-Z")[0]).toBe("keyword:DEFINT");
        expect(roles("DEFDBL P")[0]).toBe("keyword:DEFDBL");
    });

    it("colors a REM as a comment", () => {
        expect(roles("REM HELLO")).toEqual(["comment:REM HELLO"]);
    });

    /* A DATA item is colored as the value it is, not as program text. */
    it("colors DATA items by what they are", () => {
        expect(roles("DATA 95,HELLO")).toEqual([
            "keyword:DATA",
            "text: ",
            "number:95",
            "operator:,",
            "text:HELLO",
        ]);
    });
});

describe("LIST paints the line", () => {
    async function listed(...lines: string[]) {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        for (const line of lines) await interpreter.executeLine(line);
        return machine;
    }

    /** The palette index of the cell at (row, column). */
    function colorAt(machine: TestConsole, row: number, column: number) {
        const fg = machine.getCellColors(row, column)?.fg;
        return fg && "index" in fg ? fg.index : null;
    }

    it("puts the line number and the keyword in different colors", async () => {
        const machine = await listed("10 PRINT 1", "LIST");
        expect(colorAt(machine, 0, 0)).toBe(SYNTAX_COLORS.strong);
        expect(colorAt(machine, 0, 3)).toBe(SYNTAX_COLORS.builtin);
        expect(colorAt(machine, 0, 9)).toBe(SYNTAX_COLORS.number);
    });

    /*
     * Every space survives, indentation included -- a line is stored
     * from the end of its number token, not from the first thing after
     * the space. Coloring changes none of it.
     */
    it("shows the text with the typist's spacing", async () => {
        const machine = await listed("10   PRINT    1", "LIST");
        expect(machine.getRow(0)).toBe("10   PRINT    1");
    });

    /* A program that set a color should not find it changed by LIST. */
    it("leaves COLOR alone", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        await interpreter.executeLine("10 PRINT 1");
        await interpreter.executeLine("COLOR 4");
        const chosen = machine.getForeground();
        await interpreter.executeLine("LIST");

        expect(machine.getForeground()).toEqual(chosen);
        /* COLOR 4 is red in BASIC's numbering, not blue. */
        expect(chosen).toEqual(classicColors[1]);
    });
});
