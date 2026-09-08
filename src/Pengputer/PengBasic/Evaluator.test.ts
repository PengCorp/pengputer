import { describe, expect, it } from "vitest";
import { parseExpression } from "./Parser";
import {
    Evaluator,
    type Builtin,
    type Builtins,
    type Typed,
} from "./Evaluator";
import { Variables } from "./Variables";
import type { BasicType, Value } from "./values";

function makeBuiltin(
    fn: (args: Typed[]) => Value,
    min = 1,
    max = min,
    resultType: BasicType = "single",
): Builtin {
    return { minArgs: min, maxArgs: max, resultType, call: fn };
}

/* Stage 7 fills the real table; these stand in so resolution is testable. */
const FAKE_BUILTINS: Builtins = new Map<string, Builtin>([
    ["ABS", makeBuiltin((a) => Math.abs(a[0].value as number))],
    ["LEN", makeBuiltin((a) => (a[0].value as string).length, 1, 1, "integer")],
    [
        "MID$",
        makeBuiltin(
            (a) => (a[0].value as string).slice(a[1].value as number),
            2,
            3,
            "string",
        ),
    ],
]);

function run(src: string, vars = new Variables(), builtins?: Builtins): Value {
    return new Evaluator(vars, builtins).evaluate(parseExpression(src));
}

describe("arithmetic", () => {
    it("evaluates the precedence from stage 2", () => {
        expect(run("2+3*4")).toBe(14);
        expect(run("(2+3)*4")).toBe(20);
        expect(run("10-3-2")).toBe(5);
    });

    it("makes -2^2 negative four", () => {
        expect(run("-2^2")).toBe(-4);
        expect(run("(-2)^2")).toBe(4);
    });

    it("exponentiates left to right", () => {
        expect(run("2^3^2")).toBe(64);
    });

    it("refuses to divide by zero", () => {
        expect(() => run("1/0")).toThrow(/DIVISION BY ZERO/);
    });

    it("refuses a negative base to a fractional power", () => {
        expect(() => run("(0-4)^.5")).toThrow(/ILLEGAL QUANTITY/);
    });

    it("overflows past the single precision limit", () => {
        expect(() => run("1E38*10")).toThrow(/OVERFLOW/);
    });
});

describe("strings", () => {
    it("joins with +", () => {
        expect(run('"AB"+"CD"')).toBe("ABCD");
    });

    it("will not mix strings and numbers", () => {
        expect(() => run('"A"+1')).toThrow(/TYPE MISMATCH/);
        expect(() => run('1+"A"')).toThrow(/TYPE MISMATCH/);
    });

    it("has no arithmetic other than +", () => {
        expect(() => run('"A"-"B"')).toThrow(/TYPE MISMATCH/);
        expect(() => run('"A"*2')).toThrow(/TYPE MISMATCH/);
    });

    it("refuses strings longer than 255", () => {
        const vars = new Variables();
        vars.setScalar("A", "$", "x".repeat(200));
        expect(() => run("A$+A$", vars)).toThrow(/STRING TOO LONG/);
    });
});

describe("comparisons", () => {
    it("returns -1 and 0, not true and false", () => {
        expect(run("1=1")).toBe(-1);
        expect(run("1=2")).toBe(0);
        expect(run("2>1")).toBe(-1);
        expect(run("1<>1")).toBe(0);
    });

    it("supports the conditional-increment idiom", () => {
        const vars = new Variables();
        vars.setScalar("A", "", 5);
        vars.setScalar("B", "", 3);
        expect(run("0-(A>B)", vars)).toBe(1);
        expect(run("0-(B>A)", vars)).toBe(0);
    });

    it("compares strings by character code", () => {
        expect(run('"A"<"B"')).toBe(-1);
        expect(run('"Z"<"a"')).toBe(-1);
        expect(run('"AB"="AB"')).toBe(-1);
    });

    it("will not compare a string with a number", () => {
        expect(() => run('"A"=1')).toThrow(/TYPE MISMATCH/);
    });
});

describe("logic", () => {
    it("is bitwise, not boolean", () => {
        expect(run("12 AND 10")).toBe(8);
        expect(run("12 OR 10")).toBe(14);
        expect(run("NOT 0")).toBe(-1);
        expect(run("NOT 5")).toBe(-6);
    });

    it("still reads as logic for comparison results", () => {
        expect(run("(1=1) AND (2=2)")).toBe(-1);
        expect(run("(1=1) AND (2=3)")).toBe(0);
        expect(run("NOT (1=1)")).toBe(0);
    });

    it("overflows outside 16 bits", () => {
        expect(() => run("40000 AND 1")).toThrow(/OVERFLOW/);
    });
});

describe("variables", () => {
    it("reads unset variables as 0 and empty string", () => {
        expect(run("X")).toBe(0);
        expect(run("X$")).toBe("");
    });

    it("treats a bare name and a ! name as the same variable", () => {
        const vars = new Variables();
        vars.setScalar("A", "", 7);
        expect(run("A!", vars)).toBe(7);
    });

    it("keeps the sigils apart otherwise", () => {
        const vars = new Variables();
        vars.setScalar("A", "", 1);
        vars.setScalar("A", "%", 2);
        vars.setScalar("A", "$", "three");
        expect(run("A", vars)).toBe(1);
        expect(run("A%", vars)).toBe(2);
        expect(run("A$", vars)).toBe("three");
    });

    it("rounds into integer variables rather than truncating", () => {
        const vars = new Variables();
        vars.setScalar("A", "%", 2.7);
        expect(run("A%", vars)).toBe(3);
        vars.setScalar("A", "%", -2.7);
        expect(run("A%", vars)).toBe(-3);
    });

    it("rounds halves away from zero, symmetrically", () => {
        /* Math.round would give -2 here: it breaks ties towards
         * +Infinity, which no machine of this era did. */
        const vars = new Variables();
        vars.setScalar("A", "%", 2.5);
        expect(run("A%", vars)).toBe(3);
        vars.setScalar("A", "%", -2.5);
        expect(run("A%", vars)).toBe(-3);
    });

    it("never stores negative zero", () => {
        const vars = new Variables();
        vars.setScalar("A", "%", -0.2);
        expect(Object.is(run("A%", vars), 0)).toBe(true);
    });

    it("rejects a value of the wrong kind", () => {
        const vars = new Variables();
        expect(() => vars.setScalar("A", "", "text")).toThrow(/TYPE MISMATCH/);
        expect(() => vars.setScalar("A", "$", 1)).toThrow(/TYPE MISMATCH/);
    });

    it("range checks integer variables", () => {
        const vars = new Variables();
        expect(() => vars.setScalar("A", "%", 40000)).toThrow(/OVERFLOW/);
    });
});

describe("arrays", () => {
    it("is a separate namespace from the scalar of the same name", () => {
        const vars = new Variables();
        vars.setScalar("A", "", 5);
        vars.setElement("A", "", [3], 7);
        expect(run("A", vars)).toBe(5);
        expect(run("A(3)", vars)).toBe(7);
    });

    it("springs into existence with subscripts 0..10", () => {
        const vars = new Variables();
        expect(run("A(10)", vars)).toBe(0);
        expect(() => run("A(11)", vars)).toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("gives DIM(n) n+1 elements", () => {
        const vars = new Variables();
        vars.dimension("B", "", [2]);
        vars.setElement("B", "", [0], 1);
        vars.setElement("B", "", [2], 3);
        expect(run("B(0)+B(2)", vars)).toBe(4);
        expect(() => run("B(3)", vars)).toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("refuses a second DIM", () => {
        const vars = new Variables();
        vars.dimension("C", "", [5]);
        expect(() => vars.dimension("C", "", [5])).toThrow(/REDIM'D ARRAY/);
    });

    it("handles more than one dimension", () => {
        const vars = new Variables();
        vars.dimension("M", "", [2, 3]);
        vars.setElement("M", "", [1, 2], 42);
        expect(run("M(1,2)", vars)).toBe(42);
        expect(run("M(0,0)", vars)).toBe(0);
        expect(() => run("M(1,4)", vars)).toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("will not change its number of dimensions", () => {
        const vars = new Variables();
        vars.setElement("D", "", [1], 1);
        expect(() => run("D(1,1)", vars)).toThrow(/SUBSCRIPT OUT OF RANGE/);
    });

    it("keeps string arrays empty until set", () => {
        const vars = new Variables();
        expect(run("E$(4)", vars)).toBe("");
    });
});

describe("built-ins versus arrays", () => {
    it("prefers a built-in over an array of the same name", () => {
        const vars = new Variables();
        vars.setElement("LEN", "", [1], 99);
        expect(run('LEN("ABC")', vars, FAKE_BUILTINS)).toBe(3);
    });

    it("falls through to an array when no built-in matches", () => {
        const vars = new Variables();
        vars.setElement("A", "", [1], 99);
        expect(run("A(1)", vars, FAKE_BUILTINS)).toBe(99);
    });

    it("matches on the sigil too", () => {
        expect(run('MID$("HELLO",1)', new Variables(), FAKE_BUILTINS)).toBe(
            "ELLO",
        );
    });

    it("checks arity", () => {
        expect(() => run("ABS(1,2)", new Variables(), FAKE_BUILTINS)).toThrow(
            /SYNTAX/,
        );
    });

    it("treats an unknown name as an array, not an error", () => {
        expect(run("SQR(2)", new Variables(), FAKE_BUILTINS)).toBe(0);
    });
});
