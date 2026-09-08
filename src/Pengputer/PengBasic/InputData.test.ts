import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

/** Runs lines with a queue of what the user types when asked. */
async function run(lines: string[], input: string[] = []): Promise<string> {
    const machine = new TestConsole();
    machine.provideInput(...input);
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("INPUT", () => {
    it("prompts with a question mark and assigns", async () => {
        expect(await run(["10 INPUT A", "20 PRINT A", "RUN"], ["42"])).toBe(
            "? 42\n 42 \n",
        );
    });

    it("reads strings", async () => {
        expect(
            await run(["10 INPUT A$", "20 PRINT A$", "RUN"], ["PENGER"]),
        ).toBe("? PENGER\nPENGER\n");
    });

    it("keeps BASIC's question mark after a prompt joined with ;", async () => {
        expect(await run(['10 INPUT "NAME"; A$', "RUN"], ["X"])).toBe(
            "NAME? X\n",
        );
    });

    it("drops the question mark when the prompt is joined with ,", async () => {
        /* Nothing is added at all -- not even a space. A prompt wanting
         * one has to say so: INPUT "NAME ", A$ */
        expect(await run(['10 INPUT "NAME", A$', "RUN"], ["X"])).toBe(
            "NAMEX\n",
        );
        expect(await run(['10 INPUT "NAME ", A$', "RUN"], ["X"])).toBe(
            "NAME X\n",
        );
    });

    it("splits one line on commas", async () => {
        expect(
            await run(["10 INPUT A,B,C", "20 PRINT A;B;C", "RUN"], ["1,2,3"]),
        ).toBe("? 1,2,3\n 1  2  3 \n");
    });

    it("trims spaces around unquoted fields", async () => {
        expect(
            await run(["10 INPUT A,B", "20 PRINT A;B", "RUN"], [" 1 , 2 "]),
        ).toBe("?  1 , 2 \n 1  2 \n");
    });

    it("keeps a comma inside a quoted field", async () => {
        expect(
            await run(
                ["10 INPUT A$,B$", '20 PRINT A$;"/";B$', "RUN"],
                ['"X,Y",Z'],
            ),
        ).toBe('? "X,Y",Z\nX,Y/Z\n');
    });

    /*
     * There is no continuation prompt: too few values throws away what
     * was typed and asks the whole question again. Checked against
     * GW-BASIC, which answers `1' to `INPUT A,B' with "?Redo from
     * start" and a fresh `? '. This file used to assert a "?? " prompt
     * that appended, which would have let one INPUT be answered across
     * two lines.
     */
    it("starts over when given too few", async () => {
        expect(
            await run(["10 INPUT A,B", "20 PRINT A;B", "RUN"], ["1", "2,3"]),
        ).toBe("? 1\n?REDO FROM START\n? 2,3\n 2  3 \n");
    });

    it("keeps starting over until every value is there", async () => {
        expect(
            await run(
                ["10 INPUT A,B", "20 PRINT A;B", "RUN"],
                ["1", "2", "5,6"],
            ),
        ).toBe("? 1\n?REDO FROM START\n? 2\n?REDO FROM START\n? 5,6\n 5  6 \n");
    });

    it("starts over when a number was wanted and a word given", async () => {
        expect(
            await run(["10 INPUT A", "20 PRINT A", "RUN"], ["HELLO", "7"]),
        ).toBe("? HELLO\n?REDO FROM START\n? 7\n 7 \n");
    });

    /*
     * Too many is not forgiven either. GW-BASIC answers `5,6' to
     * `INPUT C' with "?Redo from start", the same as it answers too
     * few and the wrong kind -- so all three are one rule, and the
     * "?EXTRA IGNORED" this file used to assert does not happen.
     */
    it("starts over when given too many", async () => {
        expect(
            await run(["10 INPUT A", "20 PRINT A", "RUN"], ["1,2", "3"]),
        ).toBe("? 1,2\n?REDO FROM START\n? 3\n 3 \n");
    });

    /* A comma splits a string field too, so this is "too many" rather
     * than a string containing a comma. LINE INPUT is the way to get
     * one of those. */
    it("splits a string answer on commas, and so starts over", async () => {
        expect(
            await run(
                ["10 INPUT A$", '20 PRINT "[";A$;"]"', "RUN"],
                ["A,B", "AB"],
            ),
        ).toBe("? A,B\n?REDO FROM START\n? AB\n[AB]\n");
    });

    /* An empty line is one empty field, not none, so it is not "too
     * few" and does not start over. Confirmed against GW-BASIC. */
    it("accepts an empty numeric field as zero", async () => {
        expect(await run(["10 INPUT A", "20 PRINT A", "RUN"], [""])).toBe(
            "? \n 0 \n",
        );
    });

    it("assigns into array elements", async () => {
        expect(
            await run(["10 INPUT A(2)", "20 PRINT A(2)", "RUN"], ["9"]),
        ).toBe("? 9\n 9 \n");
    });

    it("breaks out of the program when the user gives up", async () => {
        /* No input queued at all, which TestConsole answers as a break. */
        expect(await run(["10 INPUT A", '20 PRINT "NOT REACHED"', "RUN"])).toBe(
            "? Break in 10\n",
        );
    });
});

describe("LINE INPUT", () => {
    it("takes the whole line, commas and all", async () => {
        expect(
            await run(
                ["10 LINE INPUT A$", "20 PRINT A$", "RUN"],
                ["SMITH, JOHN"],
            ),
        ).toBe("SMITH, JOHN\nSMITH, JOHN\n");
    });

    it("adds no question mark of its own", async () => {
        expect(await run(['10 LINE INPUT "WHO"; A$', "RUN"], ["X"])).toBe(
            "WHOX\n",
        );
    });

    it("keeps leading and trailing spaces", async () => {
        expect(
            await run(
                ["10 LINE INPUT A$", '20 PRINT "["+A$+"]"', "RUN"],
                ["  X  "],
            ),
        ).toBe("  X  \n[  X  ]\n");
    });
});

describe("DATA and READ", () => {
    it("reads items in order", async () => {
        expect(
            await run([
                "10 DATA 1,2,3",
                "20 READ A,B,C",
                "30 PRINT A;B;C",
                "RUN",
            ]),
        ).toBe(" 1  2  3 \n");
    });

    it("carries on across several DATA statements", async () => {
        expect(
            await run([
                "10 DATA 1,2",
                "20 DATA 3",
                "30 READ A,B,C",
                "40 PRINT A;B;C",
                "RUN",
            ]),
        ).toBe(" 1  2  3 \n");
    });

    it("finds DATA wherever it sits, including after the READ", async () => {
        expect(
            await run([
                "10 READ A",
                "20 PRINT A",
                "30 END",
                "40 DATA 5",
                "RUN",
            ]),
        ).toBe(" 5 \n");
    });

    it("reads unquoted text as a string", async () => {
        expect(
            await run([
                "10 DATA JOHN SMITH",
                "20 READ A$",
                "30 PRINT A$",
                "RUN",
            ]),
        ).toBe("JOHN SMITH\n");
    });

    it("reads a number into a string variable as its text", async () => {
        expect(
            await run(["10 DATA 42", "20 READ A$", "30 PRINT A$", "RUN"]),
        ).toBe("42\n");
    });

    it("refuses a word where a number was wanted", async () => {
        await expect(
            run(["10 DATA HELLO", "20 READ A", "RUN"]),
        ).rejects.toThrow(/SYNTAX/);
    });

    it("runs out of data", async () => {
        await expect(run(["10 DATA 1", "20 READ A,B", "RUN"])).rejects.toThrow(
            /OUT OF DATA/,
        );
    });

    it("does not execute DATA where it stands", async () => {
        expect(await run(["10 DATA 1,2", '20 PRINT "OK"', "RUN"])).toBe("OK\n");
    });
});

describe("RESTORE", () => {
    it("goes back to the beginning", async () => {
        expect(
            await run([
                "10 DATA 1,2",
                "20 READ A,B",
                "30 RESTORE",
                "40 READ C",
                "50 PRINT A;B;C",
                "RUN",
            ]),
        ).toBe(" 1  2  1 \n");
    });

    it("goes back to a named line", async () => {
        expect(
            await run([
                "10 DATA 1,2",
                "20 DATA 3,4",
                "30 READ A",
                "40 RESTORE 20",
                "50 READ B",
                "60 PRINT A;B",
                "RUN",
            ]),
        ).toBe(" 1  3 \n");
    });

    it("rejects a line that is not there", async () => {
        await expect(run(["10 RESTORE 99", "RUN"])).rejects.toThrow(
            /UNDEF'D STATEMENT/,
        );
    });

    it("is reset by RUN", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        for (const line of ["10 DATA 1,2", "20 READ A", "30 PRINT A"]) {
            await interpreter.executeLine(line);
        }
        await interpreter.executeLine("RUN");
        await interpreter.executeLine("RUN");
        expect(machine.getText()).toBe(" 1 \n 1 \n");
    });
});

describe("breaking out of a running program", () => {
    it("stops between statements and can be continued", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        for (const line of [
            "10 C=C+1",
            "20 IF C<100000 THEN GOTO 10",
            "30 PRINT C",
        ]) {
            await interpreter.executeLine(line);
        }

        machine.setBreak(true);
        await interpreter.executeLine("RUN");

        /* It stopped early rather than counting all the way up. */
        expect(machine.getText()).toMatch(/^Break in \d+\n$/);

        machine.setBreak(false);
        await interpreter.executeLine("CONT");
        expect(machine.getText()).toMatch(/ 100000 \n$/);
    });
});
