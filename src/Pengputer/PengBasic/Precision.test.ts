/**
 * Single precision, and the arithmetic that follows from it.
 *
 * Every number in this interpreter is a JavaScript double, which is
 * *more* accurate than the machine being imitated. Doing nothing about
 * that was the single largest silent divergence in the project: sums
 * came out right that a real machine got wrong, so output did not match
 * the sample runs printed in books.
 *
 * These tests pin the rounding rather than the arithmetic. The
 * arithmetic is JavaScript's; what is ours is *where* the rounding
 * happens, which is at every intermediate result whose type is not
 * double.
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

const value = (expr: string) => run(`PRINT ${expr}`);

describe("single precision arithmetic", () => {
    /*
     * The demonstration everybody meets eventually. Ten tenths print as
     * 1 because six digits cannot show the error, and compare unequal
     * to 1 because the error is there anyway. Both halves have to be
     * true at once or we are imitating the wrong machine.
     */
    it("does not make ten tenths one", async () => {
        expect(
            await run(
                "10 S=0",
                "20 FOR I=1 TO 10",
                "30 S=S+.1",
                "40 NEXT I",
                "50 PRINT S",
                "60 PRINT S=1",
                "RUN",
            ),
        ).toBe(" 1 \n 0 \n");
    });

    it("rounds every intermediate, not just what is stored", async () => {
        /*
         * Neither sum is ever assigned to anything, so a system that
         * only rounded on the way into a variable would give both the
         * same answer. Widening afterwards is the only way to see the
         * difference, because six digits hides it.
         */
        expect(await value("CDBL(.1+.2)")).toBe(" .300000011920929 \n");
        expect(await value("CDBL(.1)+CDBL(.2)")).toBe(" .3 \n");
    });

    it("keeps a single's error visible when widened", async () => {
        /* A! holds a 32-bit float; asking for its value as a double
         * shows what that actually was, rather than the tenth it was
         * written as. */
        expect(await run("10 A=.1", "20 PRINT CDBL(A)", "RUN")).toBe(
            " .1000000014901161 \n",
        );
    });

    it("prints six digits for a single", async () => {
        expect(await value("1/3")).toBe(" .333333 \n");
    });
});

describe("double precision", () => {
    it("prints sixteen digits", async () => {
        expect(await value("CDBL(1)/3")).toBe(" .3333333333333333 \n");
    });

    /*
     * The trap, and it is authentic: `1/3' is two single constants, so
     * it is worked out in single and *then* widened. Declaring the
     * variable double does not reach back into the expression.
     */
    it("does not retroactively widen the expression assigned to it", async () => {
        expect(await run("10 A#=1/3", "20 PRINT A#", "RUN")).toBe(
            " .3333333432674408 \n",
        );
        expect(await run("10 A#=CDBL(1)/3", "20 PRINT A#", "RUN")).toBe(
            " .3333333333333333 \n",
        );
    });

    it("keeps every digit of a literal written long", async () => {
        expect(await value("1.23456789012345#")).toBe(" 1.23456789012345 \n");
    });

    it("uses D rather than E for its exponent", async () => {
        expect(await value("1D20")).toBe(" 1D+20 \n");
        expect(await value("1E20")).toBe(" 1E+20 \n");
    });

    it("spreads through an expression from one operand", async () => {
        expect(await value("CDBL(1)/3+0")).toBe(" .3333333333333333 \n");
    });

    it("is what DEFDBL makes the default", async () => {
        expect(
            await run("10 DEFDBL A", "20 A=CDBL(1)/3", "30 PRINT A", "RUN"),
        ).toBe(" .3333333333333333 \n");
    });

    it("STR$ follows the width of its argument", async () => {
        expect(
            await run("10 A#=CDBL(1)/3", '20 PRINT "["+STR$(A#)+"]"', "RUN"),
        ).toBe("[ .3333333333333333]\n");
        expect(await value('"["+STR$(1/3)+"]"')).toBe("[ .333333]\n");
    });
});

describe("PRINT USING", () => {
    /*
     * It formats from the format string rather than from a
     * significant-digit count, so it never needed teaching about
     * width -- asking for sixteen decimal places gets sixteen. Pinned
     * here because it is easy to assume otherwise and "fix" it.
     */
    it("shows a double to whatever depth the format asks for", async () => {
        expect(
            await run(
                "10 A#=CDBL(1)/3",
                '20 PRINT USING "#.################";A#',
                "RUN",
            ),
        ).toBe("0.3333333333333333\n");
    });

    it("shows a single's real value at the same depth", async () => {
        expect(
            await run('10 PRINT USING "#.################";1/3', "RUN"),
        ).toBe("0.3333333432674408\n");
    });
});

describe("comparisons and logic answer integers", () => {
    /* Whatever went in, `=' gives -1 or 0 -- never a double. */
    it("whatever the operands were", async () => {
        expect(await value("CDBL(1)=1")).toBe("-1 \n");
        expect(await value("(1=1) AND (2=2)")).toBe("-1 \n");
    });
});

describe("the conversion functions", () => {
    it("CINT rounds to nearest and stays in sixteen bits", async () => {
        expect(await value("CINT(2.5);CINT(-2.5);CINT(2.4)")).toBe(
            " 3 -3  2 \n",
        );
        await expect(value("CINT(40000)")).rejects.toThrow(/OVERFLOW/);
    });

    it("CSNG throws away what a single cannot hold", async () => {
        expect(await run("10 A#=1.23456789", "20 PRINT CSNG(A#)", "RUN")).toBe(
            " 1.23457 \n",
        );
    });

    it("CDBL widens without changing the number", async () => {
        expect(await value("CDBL(2)")).toBe(" 2 \n");
    });

    /* FIX and INT differ only below zero, which is the whole reason
     * both exist. */
    it("FIX truncates toward zero where INT goes down", async () => {
        expect(await value("FIX(2.7);INT(2.7)")).toBe(" 2  2 \n");
        expect(await value("FIX(-2.4);INT(-2.4)")).toBe("-2 -3 \n");
    });
});

describe("HEX$ and OCT$", () => {
    it("show a number in base sixteen and base eight", async () => {
        expect(await value('HEX$(255);" ";OCT$(8)')).toBe("FF 10\n");
        expect(await value("HEX$(0)")).toBe("0\n");
    });

    it("show negatives as their sixteen-bit pattern", async () => {
        expect(await value("HEX$(-1)")).toBe("FFFF\n");
    });

    it("round to a whole number first", async () => {
        expect(await value("HEX$(255.4)")).toBe("FF\n");
    });
});

describe("ERASE", () => {
    it("lets an array be dimensioned again at a new size", async () => {
        expect(
            await run(
                "10 DIM A(5)",
                "20 ERASE A",
                "30 DIM A(20)",
                "40 A(15)=7",
                "50 PRINT A(15)",
                "RUN",
            ),
        ).toBe(" 7 \n");
    });

    it("takes several names at once", async () => {
        expect(
            await run(
                "10 DIM A(5),B$(5)",
                "20 ERASE A,B$",
                "30 DIM A(20),B$(20)",
                '40 PRINT "OK"',
                "RUN",
            ),
        ).toBe("OK\n");
    });

    it("refuses an array that was never dimensioned", async () => {
        await expect(run("10 ERASE ZZ", "RUN")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });

    /* Erasing does not touch the scalar of the same name -- they were
     * never the same variable. */
    it("leaves the scalar of the same name alone", async () => {
        expect(
            await run(
                "10 A=9",
                "20 DIM A(5)",
                "30 ERASE A",
                "40 PRINT A",
                "RUN",
            ),
        ).toBe(" 9 \n");
    });
});
