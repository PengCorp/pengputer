/**
 * CONST, OPTION BASE, REDIM, LBOUND and UBOUND.
 *
 * All four are about *storage* rather than about computing anything,
 * and two of them -- LBOUND and UBOUND -- are the reason the parser has
 * a case for something that looks like a function call and is not.
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

describe("LBOUND and UBOUND", () => {
    it("report the ends of each dimension", async () => {
        expect(
            await run(
                "10 DIM A(5,3)",
                "20 PRINT LBOUND(A);UBOUND(A);UBOUND(A,2)",
                "RUN",
            ),
        ).toBe(" 0  5  3 \n");
    });

    /*
     * The argument is a name, not a value. If UBOUND were an ordinary
     * built-in it would be handed whatever the *scalar* A holds, which
     * is a different variable entirely (§13.5).
     */
    it("do not read the scalar of the same name", async () => {
        expect(
            await run("10 A=99", "20 DIM A(4)", "30 PRINT UBOUND(A);A", "RUN"),
        ).toBe(" 4  99 \n");
    });

    /*
     * Refusing here while `PRINT ZZ(1)' happily invents the array is
     * not an inconsistency: using an array declares the shape you want,
     * asking about one presumes a shape already settled. QuickBASIC 4.5
     * says "Array not defined" too.
     */
    it("refuse an array that was never defined", async () => {
        await expect(run("PRINT UBOUND(ZZ)")).rejects.toThrow(
            /ARRAY NOT DEFINED/,
        );
    });

    it("describe an array brought into being by use", async () => {
        expect(
            await run("10 ZZ(1)=5", "20 PRINT LBOUND(ZZ);UBOUND(ZZ)", "RUN"),
        ).toBe(" 0  10 \n");
    });

    it("refuse a dimension the array does not have", async () => {
        await expect(
            run("10 DIM A(3)", "20 PRINT UBOUND(A,2)", "RUN"),
        ).rejects.toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("work on string arrays too", async () => {
        expect(await run("10 DIM N$(7)", "20 PRINT UBOUND(N$)", "RUN")).toBe(
            " 7 \n",
        );
    });
});

describe("REDIM", () => {
    it("changes the size of an array that already exists", async () => {
        expect(
            await run(
                "10 DIM A(2)",
                "20 REDIM A(20)",
                "30 A(15)=7",
                "40 PRINT A(15);UBOUND(A)",
                "RUN",
            ),
        ).toBe(" 7  20 \n");
    });

    /* Resizing is not resizing in place: the old contents are gone. */
    it("empties what was there", async () => {
        expect(
            await run(
                "10 DIM A(5)",
                "20 A(1)=9",
                "30 REDIM A(5)",
                "40 PRINT A(1)",
                "RUN",
            ),
        ).toBe(" 0 \n");
    });

    it("works on an array that does not exist yet", async () => {
        expect(await run("10 REDIM A(3)", "20 PRINT UBOUND(A)", "RUN")).toBe(
            " 3 \n",
        );
    });

    it("takes several arrays at once", async () => {
        expect(
            await run(
                "10 REDIM A(3),B$(4)",
                "20 PRINT UBOUND(A);UBOUND(B$)",
                "RUN",
            ),
        ).toBe(" 3  4 \n");
    });
});

describe("CONST", () => {
    it("names a value", async () => {
        expect(await run('10 CONST P=3,N$="HI"', "20 PRINT P;N$", "RUN")).toBe(
            " 3 HI\n",
        );
    });

    it("refuses to be assigned to", async () => {
        await expect(run("10 CONST P=3", "20 P=4", "RUN")).rejects.toThrow(
            /DUPLICATE DEFINITION/,
        );
    });

    it("refuses to be defined twice", async () => {
        await expect(
            run("10 CONST P=3", "20 CONST P=4", "RUN"),
        ).rejects.toThrow(/DUPLICATE DEFINITION/);
    });

    it("refuses to shadow a variable that already exists", async () => {
        await expect(run("10 P=1", "20 CONST P=3", "RUN")).rejects.toThrow(
            /DUPLICATE DEFINITION/,
        );
    });

    it("takes an expression, worked out once", async () => {
        expect(
            await run(
                "10 A=5",
                "20 CONST P=A*2",
                "30 A=9",
                "40 PRINT P",
                "RUN",
            ),
        ).toBe(" 10 \n");
    });

    /* A constant is typed like anything else with its sigil. */
    it("narrows to its type", async () => {
        expect(await run("10 CONST N%=2.7", "20 PRINT N%", "RUN")).toBe(
            " 3 \n",
        );
    });

    it("is forgotten by RUN", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        await interpreter.executeLine("10 CONST P=3");
        await interpreter.executeLine("RUN");
        /* A second run defines it again, which would fail if the first
         * definition had survived. */
        await interpreter.executeLine("RUN");
        expect(machine.getText()).toBe("");
    });
});

describe("OPTION BASE", () => {
    it("moves the first subscript to one", async () => {
        expect(
            await run(
                "10 OPTION BASE 1",
                "20 DIM A(3)",
                "30 PRINT LBOUND(A);UBOUND(A)",
                "RUN",
            ),
        ).toBe(" 1  3 \n");
    });

    it("makes element zero unreachable", async () => {
        await expect(
            run("10 OPTION BASE 1", "20 DIM A(3)", "30 A(0)=1", "RUN"),
        ).rejects.toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("leaves the top of the array where it was", async () => {
        expect(
            await run(
                "10 OPTION BASE 1",
                "20 DIM A(3)",
                "30 A(3)=7:PRINT A(3)",
                "RUN",
            ),
        ).toBe(" 7 \n");
    });

    /*
     * Allowing it later would silently change what the subscripts of
     * arrays that already exist mean. QuickBASIC 4.5 says "Array
     * already dimensioned"; this is the 8K spelling of that, and the
     * same error number.
     */
    it("refuses to come after an array exists", async () => {
        await expect(
            run("10 DIM A(3)", "20 OPTION BASE 1", "RUN"),
        ).rejects.toThrow(/REDIM'D ARRAY/);
    });

    it("OPTION BASE 0 is the default and always allowed", async () => {
        expect(
            await run(
                "10 OPTION BASE 0",
                "20 DIM ZZ(4)",
                "30 PRINT LBOUND(ZZ)",
                "RUN",
            ),
        ).toBe(" 0 \n");
    });

    it("refuses any other base", async () => {
        await expect(run("10 OPTION BASE 2", "RUN")).rejects.toThrow(/SYNTAX/);
    });
});
