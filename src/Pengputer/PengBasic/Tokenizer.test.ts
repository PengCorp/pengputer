import { describe, expect, it } from "vitest";
import { tokenize } from "./Tokenizer";
import { isBasicError } from "./errors";
import type { Token } from "./tokens";

/** Tokens without their positions, which are noise in most assertions. */
function kinds(src: string): Omit<Token, "pos">[] {
    return tokenize(src).map(({ pos: _pos, ...rest }) => rest);
}

describe("numbers", () => {
    it("reads integers and decimals", () => {
        expect(kinds("12 1.5 .5 5.")).toEqual([
            { kind: "number", value: 12 },
            { kind: "number", value: 1.5 },
            { kind: "number", value: 0.5 },
            { kind: "number", value: 5 },
            { kind: "end" },
        ]);
    });

    it("reads exponents in both signs and cases", () => {
        expect(kinds("1E5 1.5E-3 2e+2")).toEqual([
            { kind: "number", value: 100000 },
            { kind: "number", value: 0.0015 },
            { kind: "number", value: 200 },
            { kind: "end" },
        ]);
    });

    it("backtracks when E is not an exponent", () => {
        expect(kinds("1EA")).toEqual([
            { kind: "number", value: 1 },
            { kind: "name", name: "EA", sigil: "" },
            { kind: "end" },
        ]);
    });

    it("backtracks when E has a sign but no digits", () => {
        expect(kinds("1E+")).toEqual([
            { kind: "number", value: 1 },
            { kind: "name", name: "E", sigil: "" },
            { kind: "operator", op: "+" },
            { kind: "end" },
        ]);
    });
});

describe("strings", () => {
    it("reads a quoted string", () => {
        expect(kinds('"HELLO"')).toEqual([
            { kind: "string", value: "HELLO" },
            { kind: "end" },
        ]);
    });

    it("keeps spaces and does not honour escapes", () => {
        expect(kinds('"A \\n B"')).toEqual([
            { kind: "string", value: "A \\n B" },
            { kind: "end" },
        ]);
    });

    it("accepts an unterminated string, running to end of line", () => {
        expect(kinds('PRINT "HELLO')).toEqual([
            { kind: "keyword", keyword: "PRINT" },
            { kind: "string", value: "HELLO" },
            { kind: "end" },
        ]);
    });
});

describe("names and keywords", () => {
    it("is case insensitive and uppercases names", () => {
        expect(kinds("print score")).toEqual([
            { kind: "keyword", keyword: "PRINT" },
            { kind: "name", name: "SCORE", sigil: "" },
            { kind: "end" },
        ]);
    });

    it("matches keywords only as whole words", () => {
        /* Real MS BASIC read this as SC OR E. */
        expect(kinds("SCORE")).toEqual([
            { kind: "name", name: "SCORE", sigil: "" },
            { kind: "end" },
        ]);
        expect(kinds("TOTAL")).toEqual([
            { kind: "name", name: "TOTAL", sigil: "" },
            { kind: "end" },
        ]);
    });

    it("reads type sigils", () => {
        expect(kinds("A$ B% C! D# E")).toEqual([
            { kind: "name", name: "A", sigil: "$" },
            { kind: "name", name: "B", sigil: "%" },
            { kind: "name", name: "C", sigil: "!" },
            { kind: "name", name: "D", sigil: "#" },
            { kind: "name", name: "E", sigil: "" },
            { kind: "end" },
        ]);
    });

    it("leaves built-in functions as names", () => {
        expect(kinds("LEFT$(A$,1)")).toEqual([
            { kind: "name", name: "LEFT", sigil: "$" },
            { kind: "punct", punct: "(" },
            { kind: "name", name: "A", sigil: "$" },
            { kind: "punct", punct: "," },
            { kind: "number", value: 1 },
            { kind: "punct", punct: ")" },
            { kind: "end" },
        ]);
    });

    it("treats AND, OR and NOT as operators", () => {
        expect(kinds("A AND NOT B OR C")).toEqual([
            { kind: "name", name: "A", sigil: "" },
            { kind: "operator", op: "AND" },
            { kind: "operator", op: "NOT" },
            { kind: "name", name: "B", sigil: "" },
            { kind: "operator", op: "OR" },
            { kind: "name", name: "C", sigil: "" },
            { kind: "end" },
        ]);
    });
});

describe("operators", () => {
    it("reads comparisons written either way round", () => {
        expect(kinds("<> >< <= =< >= =>")).toEqual([
            { kind: "operator", op: "<>" },
            { kind: "operator", op: "<>" },
            { kind: "operator", op: "<=" },
            { kind: "operator", op: "<=" },
            { kind: "operator", op: ">=" },
            { kind: "operator", op: ">=" },
            { kind: "end" },
        ]);
    });

    it("rejects an illegal character", () => {
        expect(() => tokenize("A @ B")).toThrow(/SYNTAX/);
        try {
            tokenize("A @ B");
        } catch (e) {
            expect(isBasicError(e) && e.pos).toBe(2);
        }
    });
});

describe("remarks", () => {
    it("swallows the rest of the line after REM", () => {
        expect(kinds("PRINT:REM this : is , all ? comment")).toEqual([
            { kind: "keyword", keyword: "PRINT" },
            { kind: "punct", punct: ":" },
            { kind: "remark", text: " this : is , all ? comment" },
            { kind: "end" },
        ]);
    });

    it("treats an apostrophe the same way", () => {
        expect(kinds("X=1 'note")).toEqual([
            { kind: "name", name: "X", sigil: "" },
            { kind: "operator", op: "=" },
            { kind: "number", value: 1 },
            { kind: "remark", text: "note" },
            { kind: "end" },
        ]);
    });

    it("does not mistake REMARK for REM", () => {
        expect(kinds("REMARK")).toEqual([
            { kind: "name", name: "REMARK", sigil: "" },
            { kind: "end" },
        ]);
    });
});

describe("? as PRINT", () => {
    it("expands to a PRINT keyword", () => {
        expect(kinds('?"HI"')).toEqual([
            { kind: "keyword", keyword: "PRINT" },
            { kind: "string", value: "HI" },
            { kind: "end" },
        ]);
    });
});

describe("DATA", () => {
    it("reads unquoted items as text, trimmed at the edges", () => {
        expect(kinds("DATA JOHN SMITH, 42, -1.5")).toEqual([
            { kind: "keyword", keyword: "DATA" },
            { kind: "data", value: "JOHN SMITH", quoted: false },
            { kind: "data", value: "42", quoted: false },
            { kind: "data", value: "-1.5", quoted: false },
            { kind: "end" },
        ]);
    });

    it("honours quoted items", () => {
        expect(kinds('DATA "A, B", C')).toEqual([
            { kind: "keyword", keyword: "DATA" },
            { kind: "data", value: "A, B", quoted: true },
            { kind: "data", value: "C", quoted: false },
            { kind: "end" },
        ]);
    });

    it("keeps empty items", () => {
        expect(kinds("DATA 1,,3")).toEqual([
            { kind: "keyword", keyword: "DATA" },
            { kind: "data", value: "1", quoted: false },
            { kind: "data", value: "", quoted: false },
            { kind: "data", value: "3", quoted: false },
            { kind: "end" },
        ]);
    });

    it("ends at a colon and hands it back to the main scanner", () => {
        expect(kinds("DATA 1,2:PRINT")).toEqual([
            { kind: "keyword", keyword: "DATA" },
            { kind: "data", value: "1", quoted: false },
            { kind: "data", value: "2", quoted: false },
            { kind: "punct", punct: ":" },
            { kind: "keyword", keyword: "PRINT" },
            { kind: "end" },
        ]);
    });
});

describe("whole lines", () => {
    it("tokenizes a numbered statement", () => {
        expect(kinds("10 FOR I=1 TO 10 STEP 2")).toEqual([
            { kind: "number", value: 10 },
            { kind: "keyword", keyword: "FOR" },
            { kind: "name", name: "I", sigil: "" },
            { kind: "operator", op: "=" },
            { kind: "number", value: 1 },
            { kind: "keyword", keyword: "TO" },
            { kind: "number", value: 10 },
            { kind: "keyword", keyword: "STEP" },
            { kind: "number", value: 2 },
            { kind: "end" },
        ]);
    });

    it("does not need spaces around symbols", () => {
        expect(kinds("IFX>0THENPRINT")).not.toEqual(kinds("IF X>0 THEN PRINT"));
        expect(kinds("IF X>0THEN 100")).toEqual([
            { kind: "keyword", keyword: "IF" },
            { kind: "name", name: "X", sigil: "" },
            { kind: "operator", op: ">" },
            { kind: "number", value: 0 },
            { kind: "keyword", keyword: "THEN" },
            { kind: "number", value: 100 },
            { kind: "end" },
        ]);
    });

    it("records positions for error reporting", () => {
        const tokens = tokenize("10 PRINT");
        expect(tokens.map((t) => t.pos)).toEqual([0, 3, 8]);
    });

    it("returns just the sentinel for an empty line", () => {
        expect(kinds("   ")).toEqual([{ kind: "end" }]);
    });
});
