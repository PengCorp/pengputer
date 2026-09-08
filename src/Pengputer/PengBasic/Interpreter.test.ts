import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { formatNumber } from "./format";

/** Runs some lines and returns everything printed. */
async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("number formatting", () => {
    it("puts a sign position in front and a space behind", async () => {
        expect(formatNumber(1)).toBe(" 1 ");
        expect(formatNumber(-1)).toBe("-1 ");
        expect(formatNumber(0)).toBe(" 0 ");
    });

    it("drops the leading zero", async () => {
        expect(formatNumber(0.5)).toBe(" .5 ");
        expect(formatNumber(-0.25)).toBe("-.25 ");
    });

    it("strips trailing zeros", async () => {
        expect(formatNumber(1.5)).toBe(" 1.5 ");
        expect(formatNumber(100)).toBe(" 100 ");
    });

    it("keeps about six significant digits", async () => {
        expect(formatNumber(1 / 3)).toBe(" .333333 ");
        expect(formatNumber(123456)).toBe(" 123456 ");
    });

    it("switches to exponent form at the edges", async () => {
        expect(formatNumber(1e12)).toBe(" 1E+12 ");
        expect(formatNumber(1234567890123)).toBe(" 1.23457E+12 ");
        expect(formatNumber(0.001)).toBe(" 1E-03 ");
    });
});

describe("immediate mode", () => {
    it("prints", async () => {
        expect(await run('PRINT "HELLO"')).toBe("HELLO\n");
    });

    it("accepts ? for PRINT", async () => {
        expect(await run('?"HI"')).toBe("HI\n");
    });

    it("assigns with and without LET", async () => {
        expect(await run("A=2", "LET B=3", "PRINT A*B")).toBe(" 6 \n");
    });

    it("runs several statements on one line", async () => {
        expect(await run("A=1:B=2:PRINT A+B")).toBe(" 3 \n");
    });

    it("ignores remarks", async () => {
        expect(await run("REM nothing here", "PRINT 1")).toBe(" 1 \n");
    });

    it("assigns to array elements", async () => {
        expect(await run("A(3)=7", "PRINT A(3)")).toBe(" 7 \n");
    });

    it("honours DIM", async () => {
        expect(await run("DIM A(2)", "A(2)=5", "PRINT A(2)")).toBe(" 5 \n");
        await expect(run("DIM A(2)", "PRINT A(3)")).rejects.toThrow(
            /SUBSCRIPT/,
        );
    });
});

describe("PRINT punctuation", () => {
    it("puts a semicolon list straight together", async () => {
        expect(await run("PRINT 1;2;3")).toBe(" 1  2  3 \n");
    });

    it("moves a comma list into 14-column zones", async () => {
        /* " 1 " leaves the column at 3; the comma pads to 14; then the
         * second number writes its own sign space before the digit, so
         * the "2" itself lands at column 15. */
        const text = await run("PRINT 1,2");
        expect(text).toBe(" 1 " + " ".repeat(11) + " 2 \n");
        expect(text.indexOf("2")).toBe(15);
    });

    it("suppresses the newline after a trailing separator", async () => {
        expect(await run('PRINT "A";', 'PRINT "B"')).toBe("AB\n");
    });

    it("prints a bare PRINT as a blank line", async () => {
        expect(await run("PRINT")).toBe("\n");
    });

    it("moves to a column with TAB", async () => {
        expect(await run('PRINT TAB(5);"X"')).toBe("    X\n");
    });

    it("never moves TAB backwards", async () => {
        expect(await run('PRINT "ABCDEFGH";TAB(3);"X"')).toBe("ABCDEFGHX\n");
    });

    it("inserts spaces with SPC", async () => {
        expect(await run('PRINT "A";SPC(3);"B"')).toBe("A   B\n");
    });
});

/**
 * These ask *where on screen* things landed rather than what was
 * emitted, using the real TextBuffer behind TestConsole -- so wrapping
 * and cursor movement are whatever the machine actually does.
 */
describe("PRINT on the screen grid", () => {
    async function screen(
        width: number,
        ...lines: string[]
    ): Promise<TestConsole> {
        const machine = new TestConsole(width);
        const interpreter = new Interpreter(machine);
        for (const line of lines) await interpreter.executeLine(line);
        return machine;
    }

    it("lands comma-separated items on the zone boundaries", async () => {
        const output = await screen(80, "PRINT 1,2,3");
        const row = output.getRow(0);
        /* Zones start at 0, 14 and 28; each number writes its sign
         * space first, so the digit itself is one column further. */
        expect(row.indexOf("1")).toBe(1);
        expect(row.indexOf("2")).toBe(15);
        expect(row.indexOf("3")).toBe(29);
    });

    it("puts TAB output at the column asked for", async () => {
        const output = await screen(80, 'PRINT TAB(10);"X"');
        expect(output.getRow(0).indexOf("X")).toBe(9);
    });

    it("wraps past the right edge onto the next row", async () => {
        const output = await screen(20, `PRINT "${"A".repeat(25)}"`);
        expect(output.getRow(0)).toBe("A".repeat(20));
        expect(output.getRow(1)).toBe("A".repeat(5));
    });

    it("sends a comma to the next line when no zone is left", async () => {
        const output = await screen(20, 'PRINT "A","B","C"');
        expect(output.getRow(0)).toBe(`A${" ".repeat(13)}B`);
        expect(output.getRow(1)).toBe("C");
    });

    it("leaves the cursor in place after a trailing semicolon", async () => {
        const cursor = (await screen(80, 'PRINT "AB";')).getCursor();
        expect(cursor.x).toBe(2);
        expect(cursor.y).toBe(0);
    });

    it("moves the cursor to the next row after a plain PRINT", async () => {
        const cursor = (await screen(80, 'PRINT "AB"')).getCursor();
        expect(cursor.x).toBe(0);
        expect(cursor.y).toBe(1);
    });

    it("shows a whole program's output as a screen", async () => {
        const output = await screen(80, "10 PRINT 1", "20 PRINT 2", "RUN");
        expect(output.getScreen()).toEqual([" 1", " 2"]);
    });
});

describe("the stored program", () => {
    it("stores numbered lines and runs them in order", async () => {
        expect(await run("20 PRINT 2", "10 PRINT 1", "RUN")).toBe(" 1 \n 2 \n");
    });

    it("replaces a line with the same number", async () => {
        expect(await run("10 PRINT 1", "10 PRINT 99", "RUN")).toBe(" 99 \n");
    });

    it("deletes a line when only its number is typed", async () => {
        expect(await run("10 PRINT 1", "20 PRINT 2", "10", "RUN")).toBe(
            " 2 \n",
        );
    });

    it("lists what you typed, spacing and all", async () => {
        expect(await run("10   PRINT    1", "LIST")).toBe("10 PRINT    1\n");
    });

    it("lists a range", async () => {
        const program = ["10 PRINT 1", "20 PRINT 2", "30 PRINT 3"];
        expect(await run(...program, "LIST 20")).toBe("20 PRINT 2\n");
        expect(await run(...program, "LIST 20-30")).toBe(
            "20 PRINT 2\n30 PRINT 3\n",
        );
        expect(await run(...program, "LIST -20")).toBe(
            "10 PRINT 1\n20 PRINT 2\n",
        );
        expect(await run(...program, "LIST 20-")).toBe(
            "20 PRINT 2\n30 PRINT 3\n",
        );
    });

    it("stops at END", async () => {
        expect(await run("10 PRINT 1", "20 END", "30 PRINT 3", "RUN")).toBe(
            " 1 \n",
        );
    });

    it("clears everything with NEW", async () => {
        expect(await run("10 PRINT 1", "NEW", "LIST", "RUN")).toBe("");
    });

    it("keeps the program but forgets variables on RUN", async () => {
        expect(await run("A=5", "10 PRINT A", "RUN")).toBe(" 0 \n");
    });

    it("keeps variables set by the program afterwards", async () => {
        expect(await run("10 A=7", "RUN", "PRINT A")).toBe(" 7 \n");
    });
});

describe("errors", () => {
    it("reports the line a stored error happened on", async () => {
        const output = new TestConsole();
        const interpreter = new Interpreter(output);
        await interpreter.executeLine("10 PRINT 1");
        await interpreter.executeLine("20 PRINT 1/0");
        try {
            await interpreter.executeLine("RUN");
            expect.unreachable();
        } catch (e) {
            expect(
                (e as { format(n: number | null): string }).format(
                    interpreter.getRunningLine(),
                ),
            ).toBe("?DIVISION BY ZERO ERROR IN 20");
        }
    });

    it("reports immediate-mode errors without a line number", async () => {
        const output = new TestConsole();
        const interpreter = new Interpreter(output);
        try {
            await interpreter.executeLine("PRINT 1/0");
            expect.unreachable();
        } catch (e) {
            expect(
                (e as { format(n: number | null): string }).format(
                    interpreter.getRunningLine(),
                ),
            ).toBe("?DIVISION BY ZERO ERROR");
        }
    });

    it("does not notice a bad line until it runs", async () => {
        await expect(run("10 PRINT )(")).resolves.toBe("");
        await expect(run("10 PRINT )(", "RUN")).rejects.toThrow(/SYNTAX/);
    });
});

describe("pasting a listing", () => {
    it("behaves exactly as if the lines were typed", async () => {
        const listing = [
            "10 REM SQUARES",
            "20 A=1",
            "30 PRINT A;A*A",
            "40 A=2",
            "50 PRINT A;A*A",
            "60 END",
            "RUN",
        ];
        expect(await run(...listing)).toBe(" 1  1 \n 2  4 \n");
    });
});
