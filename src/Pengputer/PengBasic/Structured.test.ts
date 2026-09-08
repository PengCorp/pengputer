/**
 * Block IF, SELECT CASE, DO/LOOP and EXIT.
 *
 * All four are the same trick: a stack frame holding the one fact the
 * closing statements need, and a forward scan to find where to land
 * when a branch is not taken. None of them requires the parser to know
 * that a construct spans lines -- WHILE/WEND established that shape in
 * stage 5 and these follow it.
 */
import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("block IF", () => {
    it("runs the first branch whose condition holds", async () => {
        expect(
            await run(
                "10 X=2",
                "20 IF X=1 THEN",
                '30 PRINT "ONE"',
                "40 ELSEIF X=2 THEN",
                '50 PRINT "TWO"',
                "60 ELSE",
                '70 PRINT "OTHER"',
                "80 END IF",
                '90 PRINT "AFTER"',
                "RUN",
            ),
        ).toBe("TWO\nAFTER\n");
    });

    it("falls to ELSE when nothing matched", async () => {
        expect(
            await run(
                "10 IF 0 THEN",
                '20 PRINT "NO"',
                "30 ELSE",
                '40 PRINT "YES"',
                "50 END IF",
                "RUN",
            ),
        ).toBe("YES\n");
    });

    it("needs no ELSE at all", async () => {
        expect(
            await run(
                "10 IF 0 THEN",
                '20 PRINT "NO"',
                "30 END IF",
                '40 PRINT "ON"',
                "RUN",
            ),
        ).toBe("ON\n");
    });

    it("nests", async () => {
        expect(
            await run(
                "10 IF 1 THEN",
                "20 IF 0 THEN",
                '30 PRINT "NO"',
                "40 ELSE",
                '50 PRINT "INNER"',
                "60 END IF",
                '70 PRINT "OUTER"',
                "80 END IF",
                "RUN",
            ),
        ).toBe("INNER\nOUTER\n");
    });

    /*
     * A block IF is `IF c THEN' with nothing after THEN. Anything after
     * it is the single-line form, which is a different statement and
     * has to keep working exactly as it did.
     */
    it("does not disturb the single-line form", async () => {
        expect(await run('10 IF 1 THEN PRINT "A" ELSE PRINT "B"', "RUN")).toBe(
            "A\n",
        );
        expect(await run("10 IF 0 THEN 40", '20 PRINT "FELL"', "RUN")).toBe(
            "FELL\n",
        );
    });

    it("takes several ELSEIFs", async () => {
        const at = (x: number) =>
            run(
                `10 X=${x}`,
                "20 IF X=1 THEN",
                '30 PRINT "A"',
                "40 ELSEIF X=2 THEN",
                '50 PRINT "B"',
                "60 ELSEIF X=3 THEN",
                '70 PRINT "C"',
                "80 END IF",
                "RUN",
            );
        expect(await at(1)).toBe("A\n");
        expect(await at(3)).toBe("C\n");
        expect(await at(9)).toBe("");
    });

    /* A SELECT inside a branch must not be mistaken for that branch's
     * own structure while scanning for the ELSE. */
    it("is not confused by a SELECT CASE inside it", async () => {
        expect(
            await run(
                "10 IF 0 THEN",
                "20 SELECT CASE 1",
                "30 CASE 1",
                '40 PRINT "NO"',
                "50 END SELECT",
                "60 ELSE",
                '70 PRINT "ELSE"',
                "80 END IF",
                "RUN",
            ),
        ).toBe("ELSE\n");
    });
});

describe("SELECT CASE", () => {
    const pick = (value: string) =>
        run(
            `10 SELECT CASE ${value}`,
            "20 CASE 1",
            '30 PRINT "ONE"',
            "40 CASE 2,3",
            '50 PRINT "TWOTHREE"',
            "60 CASE 4 TO 5",
            '70 PRINT "RANGE"',
            "80 CASE IS > 5",
            '90 PRINT "BIG"',
            "100 CASE ELSE",
            '110 PRINT "NONE"',
            "120 END SELECT",
            "RUN",
        );

    it("matches a single value", async () => {
        expect(await pick("1")).toBe("ONE\n");
    });

    it("matches any of a list", async () => {
        expect(await pick("2")).toBe("TWOTHREE\n");
        expect(await pick("3")).toBe("TWOTHREE\n");
    });

    it("matches a range, inclusive at both ends", async () => {
        expect(await pick("4")).toBe("RANGE\n");
        expect(await pick("5")).toBe("RANGE\n");
    });

    it("matches a comparison with IS", async () => {
        expect(await pick("6")).toBe("BIG\n");
    });

    it("falls to CASE ELSE", async () => {
        expect(await pick("-1")).toBe("NONE\n");
    });

    /* Falling out of a matched branch has to reach END SELECT, not the
     * next CASE -- there is no fallthrough in BASIC. */
    it("runs exactly one branch", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 3",
                "20 SELECT CASE I",
                "30 CASE 1",
                '40 PRINT "A";',
                "50 CASE 2",
                '60 PRINT "B";',
                "70 CASE ELSE",
                '80 PRINT "C";',
                "90 END SELECT",
                "100 NEXT I",
                "RUN",
            ),
        ).toBe("ABC");
    });

    it("does nothing when nothing matches and there is no CASE ELSE", async () => {
        expect(
            await run(
                "10 SELECT CASE 9",
                "20 CASE 1",
                '30 PRINT "NO"',
                "40 END SELECT",
                '50 PRINT "ON"',
                "RUN",
            ),
        ).toBe("ON\n");
    });

    it("works on strings", async () => {
        expect(
            await run(
                '10 SELECT CASE "B"',
                '20 CASE "A"',
                '30 PRINT "A"',
                '40 CASE "B"',
                '50 PRINT "B"',
                "60 END SELECT",
                "RUN",
            ),
        ).toBe("B\n");
    });

    it("nests", async () => {
        expect(
            await run(
                "10 SELECT CASE 1",
                "20 CASE 1",
                "30 SELECT CASE 2",
                "40 CASE 2",
                '50 PRINT "INNER"',
                "60 END SELECT",
                '70 PRINT "OUTER"',
                "80 END SELECT",
                "RUN",
            ),
        ).toBe("INNER\nOUTER\n");
    });

    /* Once, at the top -- not per CASE. */
    it("evaluates its selector a single time", async () => {
        expect(
            await run(
                "10 N=0",
                "20 SELECT CASE FNC(0)",
                "30 CASE 99",
                '40 PRINT "NO"',
                "50 CASE ELSE",
                "60 PRINT N",
                "70 END SELECT",
                "5 DEF FNC(X)=N+1",
                "RUN",
            ),
        ).toBe(" 0 \n");
    });
});

describe("DO and LOOP", () => {
    it("tests at the top with WHILE", async () => {
        expect(
            await run(
                "10 I=0",
                "20 DO WHILE I<3",
                "30 PRINT I;",
                "40 I=I+1",
                "50 LOOP",
                "RUN",
            ),
        ).toBe(" 0  1  2 ");
    });

    it("tests at the top with UNTIL", async () => {
        expect(
            await run(
                "10 I=0",
                "20 DO UNTIL I>=3",
                "30 PRINT I;",
                "40 I=I+1",
                "50 LOOP",
                "RUN",
            ),
        ).toBe(" 0  1  2 ");
    });

    /* A top-tested loop can run no times at all. */
    it("may not run its body once", async () => {
        expect(
            await run("10 DO WHILE 0", '20 PRINT "NO"', "30 LOOP", "RUN"),
        ).toBe("");
    });

    /* A bottom-tested one always runs it at least once. */
    it("always runs the body when the test is at the bottom", async () => {
        expect(
            await run(
                "10 I=9",
                "20 DO",
                "30 PRINT I;",
                "40 I=I+1",
                "50 LOOP WHILE I<3",
                "RUN",
            ),
        ).toBe(" 9 ");
    });

    it("tests at the bottom with UNTIL", async () => {
        expect(
            await run(
                "10 I=0",
                "20 DO",
                "30 PRINT I;",
                "40 I=I+1",
                "50 LOOP UNTIL I>=3",
                "RUN",
            ),
        ).toBe(" 0  1  2 ");
    });

    it("nests", async () => {
        expect(
            await run(
                "10 I=0",
                "20 DO WHILE I<2",
                "30 J=0",
                "40 DO WHILE J<2",
                "50 PRINT I;J;",
                "60 J=J+1",
                "70 LOOP",
                "80 I=I+1",
                "90 LOOP",
                "RUN",
            ),
        ).toBe(" 0  0  0  1  1  0  1  1 ");
    });

    /*
     * One question, one answer -- and QuickBASIC reports it as an
     * unmatched LOOP rather than a syntax error, because a DO carrying
     * a test expects a bare LOOP to close it. Checked against 4.5.
     */
    it("refuses a test at both ends", async () => {
        await expect(
            run("10 DO WHILE 1", "20 LOOP WHILE 1", "RUN"),
        ).rejects.toThrow(/LOOP WITHOUT DO/);
    });

    it("reports a LOOP with no DO", async () => {
        await expect(run("10 LOOP", "RUN")).rejects.toThrow(/LOOP WITHOUT DO/);
    });
});

describe("EXIT", () => {
    it("EXIT DO leaves the loop", async () => {
        expect(
            await run(
                "10 DO",
                "20 I=I+1",
                "30 IF I=3 THEN EXIT DO",
                "40 LOOP",
                "50 PRINT I",
                "RUN",
            ),
        ).toBe(" 3 \n");
    });

    it("EXIT FOR leaves the loop with the counter as it was", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 10",
                "20 IF I=4 THEN EXIT FOR",
                "30 PRINT I;",
                "40 NEXT I",
                "50 PRINT I",
                "RUN",
            ),
        ).toBe(" 1  2  3  4 \n");
    });

    it("leaves only the innermost loop", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 2",
                "20 FOR J=1 TO 9",
                "30 IF J=2 THEN EXIT FOR",
                "40 PRINT I;J;",
                "50 NEXT J",
                "60 NEXT I",
                "RUN",
            ),
        ).toBe(" 1  1  2  1 ");
    });

    it("EXIT DO outside a loop is an error", async () => {
        await expect(run("10 EXIT DO", "RUN")).rejects.toThrow(/SYNTAX/);
    });

    it("EXIT FOR outside a loop is an error", async () => {
        await expect(run("10 EXIT FOR", "RUN")).rejects.toThrow(
            /NEXT WITHOUT FOR/,
        );
    });
});
