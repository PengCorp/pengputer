import { describe, expect, it } from "vitest";
import { parseExpression } from "./Parser";
import { isBasicError } from "./errors";
import type { Expr } from "./ast";

/**
 * Trees as S-expressions, because `(+ 2 (* 3 4))' is readable and a
 * nest of object literals four deep is not.
 */
function sexp(e: Expr): string {
    switch (e.kind) {
        case "number":
            return String(e.value);
        case "string":
            return JSON.stringify(e.value);
        case "variable":
            return e.name + e.sigil;
        case "call":
            return `(${e.name}${e.sigil} ${e.args.map(sexp).join(" ")})`;
        case "fnCall":
            return `(FN:${e.name}${e.sigil} ${e.args.map(sexp).join(" ")})`;
        case "arrayBound":
            return `(${e.which === "lower" ? "LBOUND" : "UBOUND"} ${e.name}${e.sigil}${
                e.dimension === null ? "" : " " + sexp(e.dimension)
            })`;
        case "unary":
            return `(${e.op} ${sexp(e.operand)})`;
        case "binary":
            return `(${e.op} ${sexp(e.left)} ${sexp(e.right)})`;
    }
}

const parse = (src: string) => sexp(parseExpression(src));

describe("primaries", () => {
    it("reads literals and variables", () => {
        expect(parse("42")).toBe("42");
        expect(parse('"HI"')).toBe('"HI"');
        expect(parse("A")).toBe("A");
        expect(parse("A$")).toBe("A$");
    });

    it("does not decide between a subscript and a function call", () => {
        expect(parse("A(1)")).toBe("(A 1)");
        expect(parse("SQR(2)")).toBe("(SQR 2)");
        expect(parse("LEFT$(A$,1)")).toBe("(LEFT$ A$ 1)");
        expect(parse("A(1,2)")).toBe("(A 1 2)");
    });

    it("nests calls", () => {
        expect(parse("INT(RND(1)*6)+1")).toBe("(+ (INT (* (RND 1) 6)) 1)");
    });
});

describe("precedence", () => {
    it("multiplies before adding", () => {
        expect(parse("2+3*4")).toBe("(+ 2 (* 3 4))");
        expect(parse("2*3+4")).toBe("(+ (* 2 3) 4)");
    });

    it("obeys parentheses", () => {
        expect(parse("(2+3)*4")).toBe("(* (+ 2 3) 4)");
    });

    it("compares looser than it adds", () => {
        expect(parse("A+1>B*2")).toBe("(> (+ A 1) (* B 2))");
    });

    it("puts NOT between comparison and AND", () => {
        expect(parse("NOT A=1")).toBe("(NOT (= A 1))");
        expect(parse("NOT A AND B")).toBe("(AND (NOT A) B)");
    });

    it("ANDs before ORing", () => {
        expect(parse("A OR B AND C")).toBe("(OR A (AND B C))");
        expect(parse("A AND B OR C")).toBe("(OR (AND A B) C)");
    });

    it("groups the classic comparison chain the useful way", () => {
        expect(parse("A=B AND C=D")).toBe("(AND (= A B) (= C D))");
    });
});

describe("associativity", () => {
    it("subtracts left to right", () => {
        expect(parse("10-3-2")).toBe("(- (- 10 3) 2)");
    });

    it("divides left to right", () => {
        expect(parse("100/5/2")).toBe("(/ (/ 100 5) 2)");
    });

    it("exponentiates left to right, unlike mathematics", () => {
        expect(parse("2^3^2")).toBe("(^ (^ 2 3) 2)");
    });

    it("chains comparisons left to right", () => {
        expect(parse("A=B=C")).toBe("(= (= A B) C)");
    });
});

describe("unary operators", () => {
    it("binds minus looser than the exponent", () => {
        expect(parse("-2^2")).toBe("(- (^ 2 2))");
    });

    it("allows a sign directly after the exponent operator", () => {
        expect(parse("2^-3")).toBe("(^ 2 (- 3))");
    });

    it("allows a stack of signs", () => {
        expect(parse("--3")).toBe("(- (- 3))");
        expect(parse("-+-3")).toBe("(- (- 3))");
    });

    it("binds tighter than multiplication, so it takes only the first factor", () => {
        /* Numerically identical either way -- (-A)*B and -(A*B) agree
         * for every A and B -- but the tree follows the table, and the
         * table puts unary minus above "*". Unlike "^", where the
         * grouping is observable and -2^2 really is -4. */
        expect(parse("-A*B")).toBe("(* (- A) B)");
    });
});

describe("syntax errors", () => {
    const bad = (src: string) => () => parseExpression(src);

    it("rejects a missing operand", () => {
        expect(bad("2+")).toThrow(/SYNTAX/);
    });

    it("rejects an unclosed parenthesis", () => {
        expect(bad("(2")).toThrow(/SYNTAX/);
    });

    it("rejects empty argument lists", () => {
        expect(bad("A()")).toThrow(/SYNTAX/);
    });

    it("rejects trailing rubbish", () => {
        expect(bad("1 2")).toThrow(/SYNTAX/);
    });

    it("points at the offending token", () => {
        try {
            parseExpression("1 + )");
            expect.unreachable();
        } catch (e) {
            expect(isBasicError(e) && e.pos).toBe(4);
        }
    });
});
