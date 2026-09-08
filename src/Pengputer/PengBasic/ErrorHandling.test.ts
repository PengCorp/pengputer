/**
 * ON ERROR GOTO, RESUME, ERR, ERL and ERROR.
 *
 * The interesting one is RESUME. Everything else is bookkeeping; RESUME
 * has to put execution back on the *statement* that failed, which is
 * why the main loop notes where it was before each step rather than
 * only which line it is on.
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

describe("trapping", () => {
    it("sends an error to the handler instead of stopping", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                '30 PRINT "AFTER"',
                "40 END",
                '100 PRINT "CAUGHT"',
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe("CAUGHT\nAFTER\n");
    });

    it("reports normally when nothing is trapping", async () => {
        await expect(run("10 A=1/0", "RUN")).rejects.toThrow(
            /DIVISION BY ZERO/,
        );
    });

    it("stops trapping after ON ERROR GOTO 0", async () => {
        await expect(
            run(
                "10 ON ERROR GOTO 100",
                "20 ON ERROR GOTO 0",
                "30 A=1/0",
                '100 PRINT "NO"',
                "110 RESUME NEXT",
                "RUN",
            ),
        ).rejects.toThrow(/DIVISION BY ZERO/);
    });

    /*
     * Trapping is suspended while a handler runs. Without that, a
     * mistake in the handler would send the program back to the
     * handler, forever.
     */
    it("does not trap an error raised inside the handler", async () => {
        await expect(
            run("10 ON ERROR GOTO 100", "20 A=1/0", "100 B=1/0", "RUN"),
        ).rejects.toThrow(/DIVISION BY ZERO/);
    });

    it("traps again once RESUME has been used", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                "30 B=1/0",
                '40 PRINT "DONE"',
                "50 END",
                '100 PRINT "X";',
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe("XXDONE\n");
    });

    it("is cleared by RUN", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        for (const line of ["10 ON ERROR GOTO 100", "20 END", "100 END"]) {
            await interpreter.executeLine(line);
        }
        await interpreter.executeLine("RUN");
        /* A second program, with no handler of its own. */
        await interpreter.executeLine("NEW");
        await interpreter.executeLine("10 A=1/0");
        await expect(interpreter.executeLine("RUN")).rejects.toThrow(
            /DIVISION BY ZERO/,
        );
    });

    it("reports a handler line that does not exist", async () => {
        await expect(
            run("10 ON ERROR GOTO 999", "20 A=1/0", "RUN"),
        ).rejects.toThrow(/UNDEF'D STATEMENT/);
    });
});

describe("RESUME", () => {
    it("retries the statement that failed", async () => {
        /* The handler fixes what was wrong and the division is done
         * again -- so the answer comes from the second attempt. */
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 X=0",
                "30 A=1/X",
                '40 PRINT "OK";A',
                "50 END",
                "100 X=2",
                "110 RESUME",
                "RUN",
            ),
        ).toBe("OK .5 \n");
    });

    it("RESUME NEXT carries on past it", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                '30 PRINT "PAST"',
                "40 END",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe("PAST\n");
    });

    /* Statements, not lines: the colon-separated statement after the
     * one that failed is where NEXT means. */
    it("counts statements within a line, not lines", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                '20 PRINT "A";:A=1/0:PRINT "B";',
                '30 PRINT "C"',
                "40 END",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe("ABC\n");
    });

    it("RESUME NEXT at the end of a line moves to the next line", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                '20 PRINT "A";:A=1/0',
                '30 PRINT "B"',
                "40 END",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe("AB\n");
    });

    it("RESUME <line> goes where it is told", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                '100 PRINT "H";',
                "110 RESUME 200",
                '200 PRINT "AT200"',
                "RUN",
            ),
        ).toBe("HAT200\n");
    });

    /* RESUME 0 is the documented spelling of bare RESUME. */
    it("treats RESUME 0 as a retry", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 X=0",
                "30 A=1/X",
                "40 PRINT A",
                "50 END",
                "100 X=4",
                "110 RESUME 0",
                "RUN",
            ),
        ).toBe(" .25 \n");
    });

    it("outside a handler is an error of its own", async () => {
        await expect(run("10 RESUME", "RUN")).rejects.toThrow(
            /RESUME WITHOUT ERROR/,
        );
    });

    it("comes back inside a loop and lets it carry on", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 FOR I=1 TO 3",
                "30 IF I=2 THEN A=1/0",
                "40 PRINT I;",
                "50 NEXT I",
                "60 END",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 1  2  3 ");
    });

    it("comes back inside a subroutine", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 GOSUB 200",
                '30 PRINT "BACK"',
                "40 END",
                '200 A=1/0:PRINT "SUB";',
                "210 RETURN",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe("SUBBACK\n");
    });
});

describe("ERR and ERL", () => {
    it("give the code and the line", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                "30 END",
                "100 PRINT ERR;ERL",
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 11  20 \n");
    });

    it("are zero before anything has failed", async () => {
        expect(await run("10 PRINT ERR;ERL", "RUN")).toBe(" 0  0 \n");
    });

    it("keep answering after RESUME", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                "30 PRINT ERR",
                "40 END",
                "100 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 11 \n");
    });

    it("report the line, not the statement, for a packed line", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 X=1:Y=2:A=1/0",
                "30 END",
                "100 PRINT ERL",
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 20 \n");
    });

    /* The codes are Microsoft's, because listings test against them. */
    it("use Microsoft's numbering", async () => {
        const codeOf = async (failing: string) =>
            run(
                "10 ON ERROR GOTO 100",
                `20 ${failing}`,
                "30 END",
                "100 PRINT ERR",
                "110 RESUME NEXT",
                "RUN",
            );
        expect(await codeOf("A=1/0")).toBe(" 11 \n");
        expect(await codeOf('A=VAL("1")+"X"')).toBe(" 13 \n");
        expect(await codeOf("A=SQR(-1)")).toBe(" 5 \n");
        expect(await codeOf("GOTO 9999")).toBe(" 8 \n");
        expect(await codeOf("RETURN")).toBe(" 3 \n");
    });
});

describe("ERROR", () => {
    it("raises an error the handler sees as its own", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 ERROR 11",
                "30 END",
                "100 PRINT ERR",
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 11 \n");
    });

    it("reports the matching message when nothing traps it", async () => {
        await expect(run("10 ERROR 11", "RUN")).rejects.toThrow(
            /DIVISION BY ZERO/,
        );
    });

    /* A code with no message of its own still is one. */
    it("gives UNPRINTABLE for a code we have no name for", async () => {
        await expect(run("10 ERROR 250", "RUN")).rejects.toThrow(/UNPRINTABLE/);
    });

    it("still reports that code through ERR", async () => {
        expect(
            await run(
                "10 ON ERROR GOTO 100",
                "20 ERROR 250",
                "30 END",
                "100 PRINT ERR",
                "110 RESUME NEXT",
                "RUN",
            ),
        ).toBe(" 250 \n");
    });

    it("refuses a code outside a byte", async () => {
        await expect(run("10 ERROR 300", "RUN")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });
});

describe("giving up inside a handler", () => {
    /*
     * ON ERROR GOTO 0 while handling re-reports the error that was
     * being handled, which is how a listing says "this one is not mine"
     * after inspecting ERR.
     */
    it("re-reports the original error", async () => {
        await expect(
            run(
                "10 ON ERROR GOTO 100",
                "20 A=1/0",
                '100 PRINT "SEEN";ERR',
                "110 ON ERROR GOTO 0",
                "RUN",
            ),
        ).rejects.toThrow(/DIVISION BY ZERO/);
    });
});
