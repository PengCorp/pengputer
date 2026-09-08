import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { Random } from "./random";

async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

/** The printed form of one expression. */
const value = (expr: string) => run(`PRINT ${expr}`);

describe("numeric functions", () => {
    it("ABS and SGN", async () => {
        expect(await value("ABS(-3);ABS(3)")).toBe(" 3  3 \n");
        expect(await value("SGN(-9);SGN(0);SGN(9)")).toBe("-1  0  1 \n");
    });

    it("INT rounds down, including for negatives", async () => {
        /* Not the same as storing into an integer variable, which
         * rounds to nearest: A%=-2.5 gives -3, INT(-2.5) gives -3 too,
         * but INT(-2.4) is -3 where A%=-2.4 would be -2. */
        expect(await value("INT(2.7);INT(-2.4)")).toBe(" 2 -3 \n");
    });

    it("SQR, and refuses negatives", async () => {
        expect(await value("SQR(9)")).toBe(" 3 \n");
        await expect(value("SQR(-1)")).rejects.toThrow(/ILLEGAL QUANTITY/);
    });

    it("LOG and EXP", async () => {
        expect(await value("LOG(1);EXP(0)")).toBe(" 0  1 \n");
        await expect(value("LOG(0)")).rejects.toThrow(/ILLEGAL QUANTITY/);
    });

    it("trigonometry, in radians", async () => {
        expect(await value("SIN(0);COS(0)")).toBe(" 0  1 \n");
        expect(await value("INT(ATN(1)*4*1000)")).toBe(" 3141 \n");
    });
});

describe("RND", () => {
    it("is between zero and one", async () => {
        expect(await value("RND(1)<1 AND RND(1)>=0")).toBe("-1 \n");
    });

    it("advances on a positive argument", async () => {
        expect(await run("10 A=RND(1)", "20 PRINT A=RND(1)", "RUN")).toBe(
            " 0 \n",
        );
    });

    it("repeats the last value on zero", async () => {
        expect(await run("10 A=RND(1)", "20 PRINT A=RND(0)", "RUN")).toBe(
            "-1 \n",
        );
    });

    it("reseeds on a negative argument, reproducibly", async () => {
        const first = await run("10 A=RND(-7)", "20 PRINT A", "RUN");
        const again = await run("10 A=RND(-7)", "20 PRINT A", "RUN");
        expect(first).toBe(again);
    });

    it("may be written without parentheses", async () => {
        expect(await value("RND<1")).toBe("-1 \n");
    });

    it("is repeatable after RANDOMIZE with a seed", async () => {
        const first = await run("10 RANDOMIZE 42", "20 PRINT RND(1)", "RUN");
        const again = await run("10 RANDOMIZE 42", "20 PRINT RND(1)", "RUN");
        expect(first).toBe(again);
    });

    it("gives a different run for a different seed", async () => {
        const a = await run("10 RANDOMIZE 1", "20 PRINT RND(1)", "RUN");
        const b = await run("10 RANDOMIZE 2", "20 PRINT RND(1)", "RUN");
        expect(a).not.toBe(b);
    });

    it("makes the classic dice roll work", async () => {
        const text = await run(
            "10 RANDOMIZE 3",
            "20 FOR I=1 TO 20",
            "30 D=INT(RND(1)*6)+1",
            '40 IF D<1 OR D>6 THEN PRINT "BAD";',
            "50 NEXT I",
            '60 PRINT "OK"',
            "RUN",
        );
        expect(text).toBe("OK\n");
    });
});

describe("string functions", () => {
    it("LEN", async () => {
        expect(await value('LEN("PENGER");LEN("")')).toBe(" 6  0 \n");
    });

    it("LEFT$, RIGHT$ and MID$", async () => {
        expect(await value('LEFT$("PENGER",3)')).toBe("PEN\n");
        expect(await value('RIGHT$("PENGER",3)')).toBe("GER\n");
        expect(await value('MID$("PENGER",2,3)')).toBe("ENG\n");
        expect(await value('MID$("PENGER",4)')).toBe("GER\n");
    });

    it("counts string positions from one", async () => {
        await expect(value('MID$("ABC",0,1)')).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });

    it("CHR$ and ASC", async () => {
        expect(await value('CHR$(65);ASC("A")')).toBe("A 65 \n");
        expect(await value("CHR$(34)")).toBe('"\n');
        await expect(value('ASC("")')).rejects.toThrow(/ILLEGAL QUANTITY/);
    });

    it("STR$ keeps the sign position but drops the trailing space", async () => {
        expect(await value('"["+STR$(1)+"]"')).toBe("[ 1]\n");
        expect(await value('"["+STR$(-1)+"]"')).toBe("[-1]\n");
    });

    it("VAL takes the leading number, or zero", async () => {
        expect(await value('VAL("12ABC");VAL("ABC");VAL(" -3.5")')).toBe(
            " 12  0 -3.5 \n",
        );
    });

    it("INSTR, counting from one, zero when absent", async () => {
        expect(await value('INSTR("PENGER","GE");INSTR("PENGER","Z")')).toBe(
            " 4  0 \n",
        );
        expect(await value('INSTR(5,"ABCABC","B")')).toBe(" 5 \n");
    });

    it("STRING$ and SPACE$", async () => {
        expect(await value('STRING$(3,"*")')).toBe("***\n");
        expect(await value("STRING$(3,42)")).toBe("***\n");
        expect(await value('"["+SPACE$(3)+"]"')).toBe("[   ]\n");
    });
});

describe("MID$ as a statement", () => {
    it("overwrites in place without changing the length", async () => {
        expect(
            await run(
                '10 A$="PENGER"',
                '20 MID$(A$,2,3)="XYZ"',
                "30 PRINT A$",
                "RUN",
            ),
        ).toBe("PXYZER\n");
    });

    it("takes only what fits", async () => {
        expect(
            await run(
                '10 A$="ABC"',
                '20 MID$(A$,2)="ZZZZZ"',
                "30 PRINT A$",
                "RUN",
            ),
        ).toBe("AZZ\n");
    });

    it("honours a shorter replacement", async () => {
        expect(
            await run(
                '10 A$="ABCDE"',
                '20 MID$(A$,2,3)="X"',
                "30 PRINT A$",
                "RUN",
            ),
        ).toBe("AXCDE\n");
    });
});

describe("built-ins outrank arrays", () => {
    it("uses the function even when an array shares its name", async () => {
        expect(await run("10 LEN(1)=99", '20 PRINT LEN("ABC")', "RUN")).toBe(
            " 3 \n",
        );
    });

    it("still resolves unknown names as arrays", async () => {
        expect(await run("10 ZZ(1)=99", "20 PRINT ZZ(1)", "RUN")).toBe(
            " 99 \n",
        );
    });
});

describe("Random", () => {
    it("repeats a seeded run exactly", () => {
        const a = new Random(1234);
        const b = new Random(1234);
        expect([a.next(), a.next(), a.next()]).toEqual([
            b.next(),
            b.next(),
            b.next(),
        ]);
    });

    it("stays in range over many draws", () => {
        const random = new Random(99);
        for (let i = 0; i < 10000; i += 1) {
            const value = random.next();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it("repeat() does not advance", () => {
        const random = new Random(5);
        const first = random.next();
        expect(random.repeat()).toBe(first);
        expect(random.repeat()).toBe(first);
        expect(random.next()).not.toBe(first);
    });
});
