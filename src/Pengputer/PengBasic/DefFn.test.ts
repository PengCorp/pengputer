import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";
import { parseExpression, userFunctionName } from "./Parser";

async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("defining and calling", () => {
    it("defines and calls a function", async () => {
        expect(
            await run("10 DEF FNS(X)=X*X", "20 PRINT FNS(5)", "RUN"),
        ).toBe(" 25 \n");
    });

    it("accepts a space after DEF FN", async () => {
        expect(
            await run("10 DEF FN S(X)=X*X", "20 PRINT FNS(5)", "RUN"),
        ).toBe(" 25 \n");
    });

    it("takes an expression as its argument", async () => {
        expect(
            await run("10 DEF FND(X)=X*2", "20 PRINT FND(3+4)", "RUN"),
        ).toBe(" 14 \n");
    });

    it("sees the program's other variables", async () => {
        expect(
            await run("10 M=10", "20 DEF FNS(X)=X*M", "30 PRINT FNS(3)", "RUN"),
        ).toBe(" 30 \n");
    });

    it("works with string functions", async () => {
        expect(
            await run('10 DEF FNG$(N$)=N$+"!"', '20 PRINT FNG$("HI")', "RUN"),
        ).toBe("HI!\n");
    });

    it("nests calls", async () => {
        expect(
            await run("10 DEF FND(X)=X*2", "20 PRINT FND(FND(3))", "RUN"),
        ).toBe(" 12 \n");
    });

    it("can be redefined", async () => {
        expect(
            await run(
                "10 DEF FNA(X)=X+1",
                "20 PRINT FNA(1);",
                "30 DEF FNA(X)=X+100",
                "40 PRINT FNA(1)",
                "RUN",
            ),
        ).toBe(" 2  101 \n");
    });
});

describe("the parameter is a dummy", () => {
    it("leaves the caller's variable alone", async () => {
        expect(
            await run(
                "10 X=99",
                "20 DEF FNS(X)=X*X",
                "30 PRINT FNS(3);",
                "40 PRINT X",
                "RUN",
            ),
        ).toBe(" 9  99 \n");
    });

    it("restores it even when the body fails", async () => {
        const machine = new TestConsole();
        const interpreter = new Interpreter(machine);
        for (const line of ["10 X=7", "20 DEF FNB(X)=1/0"]) {
            await interpreter.executeLine(line);
        }
        await interpreter.executeLine("RUN");
        await expect(interpreter.executeLine("PRINT FNB(3)")).rejects.toThrow(
            /DIVISION BY ZERO/,
        );
        await interpreter.executeLine("X=7");
        await interpreter.executeLine("PRINT X");
        expect(machine.getText()).toBe(" 7 \n");
    });
});

describe("errors", () => {
    it("refuses a function that was never defined", async () => {
        await expect(run("10 PRINT FNZ(1)", "RUN")).rejects.toThrow(
            /UNDEF'D FUNCTION/,
        );
    });

    it("refuses more than one argument", async () => {
        await expect(run("10 PRINT FNA(1,2)", "RUN")).rejects.toThrow(/SYNTAX/);
    });

    it("forgets definitions on RUN", async () => {
        /* The DEF is only reached by running, so calling it directly
         * after a NEW-less RUN still works -- but CLEAR wipes it. */
        await expect(
            run("10 DEF FNA(X)=X", "RUN", "CLEAR", "PRINT FNA(1)"),
        ).rejects.toThrow(/UNDEF'D FUNCTION/);
    });
});

describe("the FN prefix rule", () => {
    it("splits FNx into a call to x", () => {
        expect(userFunctionName("FNA")).toBe("A");
        expect(userFunctionName("FNSQUARE")).toBe("SQUARE");
    });

    it("leaves short and unrelated names alone", () => {
        expect(userFunctionName("FN")).toBe(null);
        expect(userFunctionName("F")).toBe(null);
        expect(userFunctionName("TOTAL")).toBe(null);
    });

    /**
     * We are gentler than the original here: it needs the "(" too, so a
     * plain variable called FNAME still works where MS would have
     * mangled it.
     */
    it("only applies to something being called", () => {
        expect(parseExpression("FNAME")).toEqual({
            kind: "variable",
            name: "FNAME",
            sigil: "",
        });
        expect(parseExpression("FNAME(1)")).toEqual({
            kind: "fnCall",
            name: "AME",
            sigil: "",
            argument: { kind: "number", value: 1 },
        });
    });
});
