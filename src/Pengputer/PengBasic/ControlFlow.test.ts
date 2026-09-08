import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { findLineReferences } from "./lineReferences";
import { tokenize } from "./Tokenizer";

async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("GOTO", () => {
    it("jumps", async () => {
        expect(await run("10 GOTO 30", "20 PRINT 2", "30 PRINT 3", "RUN")).toBe(
            " 3 \n",
        );
    });

    it("loops", async () => {
        expect(
            await run(
                "10 I=I+1",
                "20 PRINT I;",
                "30 IF I<3 THEN GOTO 10",
                "RUN",
            ),
        ).toBe(" 1  2  3 ");
    });

    it("rejects a line that is not there", async () => {
        await expect(() => run("10 GOTO 99", "RUN")).rejects.toThrow(
            /UNDEF'D STATEMENT/,
        );
    });
});

describe("GOSUB and RETURN", () => {
    it("comes back to the statement after the GOSUB", async () => {
        expect(
            await run(
                "10 GOSUB 100:PRINT 2",
                "20 END",
                "100 PRINT 1",
                "110 RETURN",
                "RUN",
            ),
        ).toBe(" 1 \n 2 \n");
    });

    it("nests", async () => {
        expect(
            await run(
                "10 GOSUB 100",
                "20 END",
                "100 PRINT 1;",
                "110 GOSUB 200",
                "120 PRINT 3;",
                "130 RETURN",
                "200 PRINT 2;",
                "210 RETURN",
                "RUN",
            ),
        ).toBe(" 1  2  3 ");
    });

    it("refuses a RETURN with nothing to return to", async () => {
        await expect(() => run("10 RETURN", "RUN")).rejects.toThrow(
            /RETURN WITHOUT GOSUB/,
        );
    });
});

describe("IF", () => {
    it("takes a bare line number as a GOTO", async () => {
        expect(
            await run("10 IF 1 THEN 30", "20 PRINT 2", "30 PRINT 3", "RUN"),
        ).toBe(" 3 \n");
    });

    it("accepts IF ... GOTO", async () => {
        expect(
            await run("10 IF 1 GOTO 30", "20 PRINT 2", "30 PRINT 3", "RUN"),
        ).toBe(" 3 \n");
    });

    it("skips the whole rest of the line when false", async () => {
        /* The colon does not end the IF: both statements belong to it. */
        expect(
            await run(
                '10 IF 0 THEN PRINT "A":PRINT "B"',
                '20 PRINT "C"',
                "RUN",
            ),
        ).toBe("C\n");
    });

    it("runs the whole rest of the line when true", async () => {
        expect(await run('10 IF 1 THEN PRINT "A":PRINT "B"', "RUN")).toBe(
            "A\nB\n",
        );
    });

    it("takes the ELSE arm", async () => {
        expect(await run('10 IF 0 THEN PRINT "A" ELSE PRINT "B"', "RUN")).toBe(
            "B\n",
        );
    });

    it("binds ELSE to the nearest IF", async () => {
        expect(
            await run('10 IF 1 THEN IF 0 THEN PRINT "A" ELSE PRINT "B"', "RUN"),
        ).toBe("B\n");
    });

    it("treats any non-zero value as true", async () => {
        expect(await run('10 IF -1 THEN PRINT "Y"', "RUN")).toBe("Y\n");
        expect(await run('10 IF 5 THEN PRINT "Y"', "RUN")).toBe("Y\n");
    });
});

describe("FOR and NEXT", () => {
    it("counts", async () => {
        expect(
            await run("10 FOR I=1 TO 3", "20 PRINT I;", "30 NEXT I", "RUN"),
        ).toBe(" 1  2  3 ");
    });

    it("steps", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 9 STEP 3",
                "20 PRINT I;",
                "30 NEXT",
                "RUN",
            ),
        ).toBe(" 1  4  7 ");
    });

    it("counts down", async () => {
        expect(
            await run(
                "10 FOR I=3 TO 1 STEP -1",
                "20 PRINT I;",
                "30 NEXT",
                "RUN",
            ),
        ).toBe(" 3  2  1 ");
    });

    it("runs the body once even when the limit is already passed", async () => {
        /* The limit is tested at NEXT, not at FOR. */
        expect(
            await run("10 FOR I=1 TO 0", "20 PRINT I;", "30 NEXT", "RUN"),
        ).toBe(" 1 ");
    });

    it("leaves the counter one step past the limit", async () => {
        expect(
            await run("10 FOR I=1 TO 3", "20 NEXT", "30 PRINT I", "RUN"),
        ).toBe(" 4 \n");
    });

    it("nests", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 2",
                "20 FOR J=1 TO 2",
                "30 PRINT I;J;",
                "40 NEXT J",
                "50 NEXT I",
                "RUN",
            ),
        ).toBe(" 1  1  1  2  2  1  2  2 ");
    });

    it("closes several loops with one NEXT", async () => {
        expect(
            await run(
                "10 FOR I=1 TO 2",
                "20 FOR J=1 TO 2",
                "30 PRINT I;J;",
                "40 NEXT J,I",
                "RUN",
            ),
        ).toBe(" 1  1  1  2  2  1  2  2 ");
    });

    it("refuses a NEXT with no loop", async () => {
        await expect(() => run("10 NEXT", "RUN")).rejects.toThrow(
            /NEXT WITHOUT FOR/,
        );
    });

    it("refuses a NEXT naming a loop that is not open", async () => {
        await expect(() =>
            run("10 FOR I=1 TO 2", "20 NEXT J", "RUN"),
        ).rejects.toThrow(/NEXT WITHOUT FOR/);
    });

    it("does not leak a frame when a loop is re-entered by GOTO", async () => {
        expect(
            await run(
                "10 C=C+1",
                "20 FOR I=1 TO 2",
                "30 NEXT I",
                "40 IF C<500 THEN GOTO 10",
                "50 PRINT C",
                "RUN",
            ),
        ).toBe(" 500 \n");
    });
});

describe("ON", () => {
    it("picks the nth line", async () => {
        const program = [
            "20 ON X GOTO 100,200",
            "30 END",
            "100 PRINT 1",
            "110 END",
            "200 PRINT 2",
            "210 END",
        ];
        expect(await run("10 X=1", ...program, "RUN")).toBe(" 1 \n");
        expect(await run("10 X=2", ...program, "RUN")).toBe(" 2 \n");
    });

    it("falls through when out of range", async () => {
        expect(
            await run(
                "10 X=9",
                "20 ON X GOTO 100",
                "30 PRINT 3",
                "40 END",
                "100 PRINT 1",
                "RUN",
            ),
        ).toBe(" 3 \n");
    });

    it("falls through on zero", async () => {
        expect(
            await run(
                "10 X=0",
                "20 ON X GOTO 100",
                "30 PRINT 3",
                "40 END",
                "100 PRINT 1",
                "RUN",
            ),
        ).toBe(" 3 \n");
    });

    it("returns from ON ... GOSUB", async () => {
        expect(
            await run(
                "10 ON 1 GOSUB 100",
                "20 PRINT 2",
                "30 END",
                "100 PRINT 1",
                "110 RETURN",
                "RUN",
            ),
        ).toBe(" 1 \n 2 \n");
    });
});

describe("WHILE and WEND", () => {
    it("loops while true", async () => {
        expect(
            await run(
                "10 I=1",
                "20 WHILE I<4",
                "30 PRINT I;",
                "40 I=I+1",
                "50 WEND",
                "RUN",
            ),
        ).toBe(" 1  2  3 ");
    });

    it("skips the body when false at the start", async () => {
        expect(
            await run(
                "10 WHILE 0",
                '20 PRINT "NO"',
                "30 WEND",
                '40 PRINT "YES"',
                "RUN",
            ),
        ).toBe("YES\n");
    });

    it("skips past the matching WEND, not the first one", async () => {
        expect(
            await run(
                "10 WHILE 0",
                "20 WHILE 1",
                "30 WEND",
                "40 WEND",
                '50 PRINT "OUT"',
                "RUN",
            ),
        ).toBe("OUT\n");
    });

    it("refuses a WEND with no WHILE", async () => {
        await expect(() => run("10 WEND", "RUN")).rejects.toThrow(
            /WEND WITHOUT WHILE/,
        );
    });

    it("refuses a WHILE with no WEND", async () => {
        await expect(() =>
            run("10 WHILE 0", '20 PRINT "X"', "RUN"),
        ).rejects.toThrow(/WHILE WITHOUT WEND/);
    });
});

describe("STOP and CONT", () => {
    it("stops with the line number and carries on", async () => {
        expect(
            await run("10 PRINT 1", "20 STOP", "30 PRINT 3", "RUN", "CONT"),
        ).toBe(" 1 \nBreak in 20\n 3 \n");
    });

    it("keeps variables across the break", async () => {
        expect(await run("10 A=7", "20 STOP", "RUN", "PRINT A")).toBe(
            "Break in 20\n 7 \n",
        );
    });

    it("refuses to continue when there is nothing to continue", async () => {
        await expect(() => run("CONT")).rejects.toThrow(/CAN'T CONTINUE/);
    });

    it("refuses to continue after the program is edited", async () => {
        await expect(() =>
            run("10 STOP", "RUN", "20 PRINT 2", "CONT"),
        ).rejects.toThrow(/CAN'T CONTINUE/);
    });
});

describe("SWAP", () => {
    it("exchanges scalars", async () => {
        expect(
            await run("10 A=1:B=2", "20 SWAP A,B", "30 PRINT A;B", "RUN"),
        ).toBe(" 2  1 \n");
    });

    it("exchanges array elements", async () => {
        expect(
            await run(
                "10 A(1)=1:A(2)=2",
                "20 SWAP A(1),A(2)",
                "30 PRINT A(1);A(2)",
                "RUN",
            ),
        ).toBe(" 2  1 \n");
    });

    it("refuses to mix types", async () => {
        await expect(() =>
            run("10 A=1", '20 B$="X"', "30 SWAP A,B$", "RUN"),
        ).rejects.toThrow(/TYPE MISMATCH/);
    });
});

describe("TRON and TROFF", () => {
    it("prints each line number as it runs", async () => {
        expect(await run("10 PRINT 1", "20 PRINT 2", "TRON", "RUN")).toBe(
            "[10] 1 \n[20] 2 \n",
        );
    });

    it("stops again on TROFF", async () => {
        expect(await run("10 PRINT 1", "TRON", "TROFF", "RUN")).toBe(" 1 \n");
    });
});

describe("line references, for RENUM", () => {
    const refs = (source: string) => {
        const tokens = tokenize(source);
        return findLineReferences(tokens).map((i) => {
            const token = tokens[i];
            return token.kind === "number" ? token.value : null;
        });
    };

    it("finds jump targets", async () => {
        expect(refs("GOTO 100")).toEqual([100]);
        expect(refs("GOSUB 250")).toEqual([250]);
        expect(refs("IF X THEN 100 ELSE 200")).toEqual([100, 200]);
    });

    it("finds every target of an ON", async () => {
        expect(refs("ON X GOTO 10,20,30")).toEqual([10, 20, 30]);
    });

    it("ignores numbers that are not line references", async () => {
        expect(refs("PRINT 100")).toEqual([]);
        expect(refs("A=100")).toEqual([]);
        expect(refs("IF X THEN PRINT 100")).toEqual([]);
        expect(refs("FOR I=1 TO 100")).toEqual([]);
    });
});
