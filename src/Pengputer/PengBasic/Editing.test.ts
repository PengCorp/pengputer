import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { rewriteLineReferences } from "./lineReferences";

function machine() {
    const console = new TestConsole();
    return { console, interpreter: new Interpreter(console) };
}

async function feed(interpreter: Interpreter, ...lines: string[]) {
    for (const line of lines) await interpreter.executeLine(line);
}

/** The program as LIST would show it. */
async function listing(...lines: string[]): Promise<string> {
    const { console, interpreter } = machine();
    await feed(interpreter, ...lines);
    const before = console.getText().length;
    await interpreter.executeLine("LIST");
    return console.getText().slice(before);
}

describe("DELETE", () => {
    const program = ["10 PRINT 1", "20 PRINT 2", "30 PRINT 3", "40 PRINT 4"];

    it("deletes one line", async () => {
        expect(await listing(...program, "DELETE 20")).toBe(
            "10 PRINT 1\n30 PRINT 3\n40 PRINT 4\n",
        );
    });

    it("deletes a range", async () => {
        expect(await listing(...program, "DELETE 20-30")).toBe(
            "10 PRINT 1\n40 PRINT 4\n",
        );
    });

    it("deletes from the start and to the end", async () => {
        expect(await listing(...program, "DELETE -20")).toBe(
            "30 PRINT 3\n40 PRINT 4\n",
        );
        expect(await listing(...program, "DELETE 30-")).toBe(
            "10 PRINT 1\n20 PRINT 2\n",
        );
    });

    it("refuses a bare DELETE", async () => {
        const { interpreter } = machine();
        await feed(interpreter, ...program);
        await expect(interpreter.executeLine("DELETE")).rejects.toThrow(
            /SYNTAX/,
        );
    });
});

describe("RENUM", () => {
    it("renumbers by tens from ten", async () => {
        expect(
            await listing("1 PRINT 1", "7 PRINT 2", "9 PRINT 3", "RENUM"),
        ).toBe("10 PRINT 1\n20 PRINT 2\n30 PRINT 3\n");
    });

    it("takes a start and an increment", async () => {
        expect(await listing("1 PRINT 1", "2 PRINT 2", "RENUM 100,,5")).toBe(
            "100 PRINT 1\n105 PRINT 2\n",
        );
    });

    it("renumbers only from a given line", async () => {
        expect(
            await listing(
                "10 PRINT 1",
                "20 PRINT 2",
                "30 PRINT 3",
                "RENUM 100,20,10",
            ),
        ).toBe("10 PRINT 1\n100 PRINT 2\n110 PRINT 3\n");
    });

    it("moves every kind of reference with the line", async () => {
        expect(
            await listing(
                "1 GOTO 5",
                "2 GOSUB 6",
                "3 IF X THEN 5 ELSE 6",
                "4 ON X GOTO 5,6",
                "5 RESTORE 6",
                "6 END",
                "RENUM",
            ),
        ).toBe(
            "10 GOTO 50\n" +
                "20 GOSUB 60\n" +
                "30 IF X THEN 50 ELSE 60\n" +
                "40 ON X GOTO 50,60\n" +
                "50 RESTORE 60\n" +
                "60 END\n",
        );
    });

    it("leaves the typist's spacing alone", async () => {
        expect(await listing("1   GOTO    5", "5 END", "RENUM")).toBe(
            "10   GOTO    20\n20 END\n",
        );
    });

    it("does not touch numbers that are not line references", async () => {
        expect(
            await listing("1 PRINT 5", "2 A=5", "5 FOR I=1 TO 5", "RENUM"),
        ).toBe("10 PRINT 5\n20 A=5\n30 FOR I=1 TO 5\n");
    });

    it("still runs after renumbering", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "1 FOR I=1 TO 3",
            "2 GOSUB 7",
            "3 NEXT I",
            "4 END",
            "7 PRINT I;",
            "8 RETURN",
            "RENUM",
        );
        await interpreter.executeLine("RUN");
        expect(console.getText()).toBe(" 1  2  3 ");
    });

    it("reports a reference to a line that is gone", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "1 GOTO 99", "RENUM");
        expect(console.getText()).toBe("?UNDEFINED LINE 99 IN 10\n");
    });

    it("refuses to shuffle the program out of order", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 PRINT 1", "20 PRINT 2");
        await expect(interpreter.executeLine("RENUM 5,20,10")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });

    it("refuses an increment of zero", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 PRINT 1");
        await expect(interpreter.executeLine("RENUM 10,,0")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });
});

describe("rewriteLineReferences", () => {
    const map = new Map([
        [5, 50],
        [10, 100],
    ]);

    it("splices without disturbing anything else", () => {
        expect(rewriteLineReferences("IF A=5 THEN 5 ELSE 10", map).source).toBe(
            "IF A=5 THEN 50 ELSE 100",
        );
    });

    it("handles several references on one line", () => {
        expect(rewriteLineReferences("ON X GOTO 5,10,5", map).source).toBe(
            "ON X GOTO 50,100,50",
        );
    });

    it("copes with the number changing width", () => {
        expect(rewriteLineReferences("GOTO 10:PRINT 1", map).source).toBe(
            "GOTO 100:PRINT 1",
        );
    });

    it("reports targets it cannot find and leaves them alone", () => {
        const result = rewriteLineReferences("GOTO 99", map);
        expect(result.source).toBe("GOTO 99");
        expect(result.missing).toEqual([99]);
    });

    it("leaves a line it cannot tokenize completely alone", () => {
        expect(rewriteLineReferences("GOTO 5 @ @", map).source).toBe(
            "GOTO 5 @ @",
        );
    });
});

describe("AUTO", () => {
    it("offers line numbers, counting on", async () => {
        const { interpreter } = machine();
        await interpreter.executeLine("AUTO");
        expect(interpreter.takePendingPrefill()).toBe("10 ");

        await interpreter.executeLine("10 PRINT 1");
        expect(interpreter.takePendingPrefill()).toBe("20 ");

        await interpreter.executeLine("20 PRINT 2");
        expect(interpreter.takePendingPrefill()).toBe("30 ");
    });

    it("takes a start and an increment", async () => {
        const { interpreter } = machine();
        await interpreter.executeLine("AUTO 100,5");
        expect(interpreter.takePendingPrefill()).toBe("100 ");
        await interpreter.executeLine("100 PRINT 1");
        expect(interpreter.takePendingPrefill()).toBe("105 ");
    });

    it("counts on from what was actually typed", async () => {
        const { interpreter } = machine();
        await interpreter.executeLine("AUTO");
        await interpreter.executeLine("55 PRINT 1");
        expect(interpreter.takePendingPrefill()).toBe("65 ");
    });

    it("stops when cancelled", async () => {
        const { interpreter } = machine();
        await interpreter.executeLine("AUTO");
        expect(interpreter.getIsAuto()).toBe(true);
        interpreter.cancelAuto();
        expect(interpreter.getIsAuto()).toBe(false);
        expect(interpreter.takePendingPrefill()).toBe(null);
    });
});

describe("EDIT", () => {
    it("hands the line back for editing", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10   PRINT    1", "EDIT 10");
        expect(interpreter.takePendingPrefill()).toBe("10   PRINT    1");
    });

    it("is a one-shot", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 PRINT 1", "EDIT 10");
        expect(interpreter.takePendingPrefill()).toBe("10 PRINT 1");
        expect(interpreter.takePendingPrefill()).toBe(null);
    });

    it("refuses a line that is not there", async () => {
        const { interpreter } = machine();
        await expect(interpreter.executeLine("EDIT 99")).rejects.toThrow(
            /UNDEF'D STATEMENT/,
        );
    });
});

describe("LIST a screenful at a time", () => {
    /** A program of `count' numbered lines. */
    function program(count: number): string[] {
        const lines: string[] = [];
        for (let i = 1; i <= count; i += 1) lines.push(`${i * 10} PRINT ${i}`);
        return lines;
    }

    it("shows everything when it fits", async () => {
        const console = new TestConsole(80, 10);
        const interpreter = new Interpreter(console);
        await feed(interpreter, ...program(5));
        const before = console.getText().length;
        await interpreter.executeLine("LIST");
        expect(console.getText().slice(before).split("\n")).toHaveLength(6);
    });

    it("pauses once a screenful has gone by", async () => {
        const console = new TestConsole(80, 10);
        const interpreter = new Interpreter(console);
        await feed(interpreter, ...program(20));
        console.provideKeys(" ", " ", " ");

        const before = console.getText().length;
        await interpreter.executeLine("LIST");
        const listing = console.getText().slice(before);

        expect(listing).toContain("-- MORE --");
        /* Every line still arrives, prompt or no prompt. */
        for (let i = 1; i <= 20; i += 1) {
            expect(listing).toContain(`${i * 10} PRINT ${i}`);
        }
    });

    it("takes its page size from the screen", async () => {
        const short = new TestConsole(80, 5);
        const tall = new TestConsole(80, 40);
        for (const console of [short, tall]) {
            const interpreter = new Interpreter(console);
            await feed(interpreter, ...program(20));
            console.provideKeys(...Array(10).fill(" "));
            await interpreter.executeLine("LIST");
        }
        const pauses = (text: string) => text.split("-- MORE --").length - 1;
        expect(pauses(short.getText())).toBeGreaterThan(pauses(tall.getText()));
    });

    it("stops when the user breaks out at the prompt", async () => {
        const console = new TestConsole(80, 10);
        const interpreter = new Interpreter(console);
        await feed(interpreter, ...program(30));
        console.provideKeys("\x03");

        const before = console.getText().length;
        await interpreter.executeLine("LIST");
        const listing = console.getText().slice(before);

        expect(listing).toContain("10 PRINT 1");
        expect(listing).not.toContain("300 PRINT 30");
    });
});

describe("EDIT with no line number", () => {
    it("offers back the line that just failed", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 PRINT 1", "20 PRINT 1/0");
        await expect(interpreter.executeLine("RUN")).rejects.toThrow(
            /DIVISION BY ZERO/,
        );
        await interpreter.executeLine("EDIT");
        expect(interpreter.takePendingPrefill()).toBe("20 PRINT 1/0");
    });

    it("refuses when nothing has gone wrong yet", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 PRINT 1");
        await expect(interpreter.executeLine("EDIT")).rejects.toThrow(
            /UNDEF'D STATEMENT/,
        );
    });
});

describe("CLEAR with arguments", () => {
    it("accepts the string space a listing asks for", async () => {
        const { interpreter } = machine();
        await expect(
            interpreter.executeLine("CLEAR 500"),
        ).resolves.toBeDefined();
        await expect(
            interpreter.executeLine("CLEAR ,32768"),
        ).resolves.toBeDefined();
        await expect(
            interpreter.executeLine("CLEAR 500,32768"),
        ).resolves.toBeDefined();
    });

    it("still forgets the variables", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "A=7", "CLEAR 500", "PRINT A");
        expect(console.getText()).toBe(" 0 \n");
    });
});

describe("runaway programs stop with an error", () => {
    it("catches endless GOSUB", async () => {
        const { interpreter } = machine();
        await feed(interpreter, "10 GOSUB 10");
        await expect(interpreter.executeLine("RUN")).rejects.toThrow(
            /OUT OF MEMORY/,
        );
    });

    it("leaves ordinary nesting alone", async () => {
        /* A hundred deep, which the limit is set well clear of. */
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 GOSUB 100",
            "20 PRINT D",
            "30 END",
            "100 D=D+1",
            "110 IF D<100 THEN GOSUB 100",
            "120 RETURN",
            "RUN",
        );
        expect(console.getText()).toBe(" 100 \n");
    });
});
