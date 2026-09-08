import { describe, expect, it } from "vitest";
import { printUsing } from "./printUsing";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

async function run(...lines: string[]): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    for (const line of lines) await interpreter.executeLine(line);
    return machine.getText();
}

describe("numeric fields", () => {
    it("right-aligns in the digit positions", () => {
        expect(printUsing("###", [5])).toBe("  5");
        expect(printUsing("###", [123])).toBe("123");
    });

    it("rounds to the decimal places asked for", () => {
        expect(printUsing("###.##", [3.14159])).toBe("  3.14");
        expect(printUsing("#.#", [0.25])).toBe("0.3");
    });

    it("keeps a negative sign", () => {
        expect(printUsing("###", [-5])).toBe(" -5");
    });

    it("groups thousands on request", () => {
        expect(printUsing("#,###,###", [1234567])).toBe("1,234,567");
        expect(printUsing("#,###.##", [1234.5])).toBe("1,234.50");
    });

    it("prints a leading sign when asked", () => {
        expect(printUsing("+###", [5])).toBe("  +5");
        expect(printUsing("+###", [-5])).toBe("  -5");
    });

    it("prints a trailing sign when asked", () => {
        expect(printUsing("###+", [5])).toBe("  5+");
        expect(printUsing("###-", [-5])).toBe("  5-");
        expect(printUsing("###-", [5])).toBe("  5 ");
    });

    it("floats a dollar sign up against the digits", () => {
        expect(printUsing("$$###.##", [12.3])).toBe("  $12.30");
    });

    it("fills with asterisks", () => {
        expect(printUsing("**###", [12])).toBe("***12");
    });

    it("flags a number too wide for its field rather than truncating", () => {
        expect(printUsing("##", [12345])).toBe("%12345");
    });
});

describe("string fields", () => {
    it("takes one character for !", () => {
        expect(printUsing("!", ["PENGER"])).toBe("P");
    });

    it("pads or truncates a backslash field to its width", () => {
        expect(printUsing("\\  \\", ["PENGER"])).toBe("PENG");
        expect(printUsing("\\  \\", ["AB"])).toBe("AB  ");
    });

    it("takes the whole string for &", () => {
        expect(printUsing("&", ["PENGER"])).toBe("PENGER");
    });
});

describe("literals and escapes", () => {
    it("copies anything that is not a field", () => {
        expect(printUsing("TOTAL: ###", [42])).toBe("TOTAL:  42");
    });

    it("prints the character after an underscore literally", () => {
        expect(printUsing("_####", [5])).toBe("#  5");
    });

    it("refuses a format with no fields at all", () => {
        expect(() => printUsing("NOTHING", [1])).toThrow(/ILLEGAL QUANTITY/);
    });
});

describe("more values than fields", () => {
    it("starts the format over", () => {
        expect(printUsing("##;", [1, 2, 3])).toBe(" 1; 2; 3;");
    });

    /*
     * Dead stop: the literal between the exhausted field and the next
     * one is not printed either. Checked against GW-BASIC, which ends
     * `PRINT USING "## ##";1' after the 1, with no trailing space.
     */
    it("stops as soon as the values run out", () => {
        expect(printUsing("## ##", [1])).toBe(" 1");
    });

    it("still prints what follows the last field", () => {
        expect(printUsing("[##]", [1])).toBe("[ 1]");
    });
});

/*
 * Everything in this block was checked against a real GW-BASIC, and all
 * three were wrong here before it was.
 */
describe("checked against the real thing", () => {
    /*
     * `**$' is one prefix meaning both. Parsing it as `**' left a stray
     * `$' as literal text and a second field behind it, so this used to
     * print "12$" and then stop for want of a second value.
     */
    it("takes **$ as asterisk fill and a floating dollar together", () => {
        expect(printUsing("**$##.##", [12.3])).toBe("**$12.30");
    });

    /* A field asking for no integer digits shows none: 0.5 is .50. */
    it("drops the leading zero when no digit position asks for it", () => {
        expect(printUsing(".##", [0.5])).toBe(".50");
    });

    /* But a value that does have an integer part still overflows --
     * which is the point of asking for none. */
    it("still overflows when there is an integer part to show", () => {
        expect(printUsing(".##", [1.5])).toBe("%1.50");
    });

    /* The cases that were already right, kept so a change that breaks
     * them is caught by something that says where the answer came from. */
    it("agrees with GW-BASIC on the rest", () => {
        expect(printUsing("###", [12345])).toBe("%12345");
        expect(printUsing("#.#", [0.25])).toBe("0.3");
        expect(printUsing("##", [1.5])).toBe(" 2");
        expect(printUsing("##", [2.5])).toBe(" 3");
        expect(printUsing("$$#.##", [-1.5])).toBe("-$1.50");
        expect(printUsing("$$###.##", [12.3])).toBe("  $12.30");
        expect(printUsing("**###", [12])).toBe("***12");
        expect(printUsing("###.", [5])).toBe("  5.");
        expect(printUsing("#", [10])).toBe("%10");
        expect(printUsing("###-", [5])).toBe("  5 ");
        expect(printUsing("###-", [-5])).toBe("  5-");
        expect(printUsing("_####", [5])).toBe("#  5");
    });
});

/**
 * Exponential fields, checked line for line against GW-BASIC.
 *
 * The rule the samples gave up: the mantissa gets one fewer integer
 * digit than there are digit positions, because one of them belongs to
 * the sign. An explicit `+' takes that job and hands the digit back.
 */
describe("exponential fields", () => {
    it("shows one mantissa digit for two positions", () => {
        expect(printUsing("##.##^^^^", [1234])).toBe(" 1.23E+03");
    });

    /* The `+' has a position of its own, so both `#' hold digits. */
    it("shows two when a sign position is spelled out", () => {
        expect(printUsing("+##.##^^^^", [1234])).toBe("+12.34E+02");
    });

    it("shows none when there is only the sign's position", () => {
        expect(printUsing("#.##^^^^", [1234])).toBe("0.12E+04");
    });

    it("shows three for four positions", () => {
        expect(printUsing("####.##^^^^", [1234])).toBe(" 123.40E+01");
    });

    /* Nowhere to put a mantissa at all: just the exponent. */
    it("shows no mantissa when nothing is left for one", () => {
        expect(printUsing("#^^^^", [1234])).toBe(" E+04");
    });

    it("puts the sign in the position kept for it", () => {
        expect(printUsing("##.##^^^^", [-1234])).toBe("-1.23E+03");
    });

    it("takes a negative exponent", () => {
        expect(printUsing("##.##^^^^", [0.001234])).toBe(" 1.23E-03");
    });

    it("shows zero without pretending it has an exponent", () => {
        expect(printUsing("##.##^^^^", [0])).toBe(" 0.00E+00");
    });

    /* Exactly four carets are the field; a fifth is literal text. */
    it("takes four carets and leaves the rest alone", () => {
        expect(printUsing("##.##^^^^^", [1234])).toBe(" 1.23E+03^");
    });

    /*
     * Rounding can push the mantissa up a digit -- 9.99 to one place is
     * 10.0, which is one too many for a field allowing one -- so the
     * exponent moves instead. Checked, like the rest of this block.
     */
    it("keeps the mantissa in its digits when rounding grows it", () => {
        expect(printUsing("##.#^^^^", [9.99])).toBe(" 1.0E+01");
    });
});

describe("from a program", () => {
    it("prints a formatted line", async () => {
        expect(await run('10 PRINT USING "###.##"; 3.14159', "RUN")).toBe(
            "  3.14\n",
        );
    });

    it("takes several values", async () => {
        expect(await run('10 PRINT USING "## ## ##"; 1,2,3', "RUN")).toBe(
            " 1  2  3\n",
        );
    });

    it("suppresses the newline after a trailing separator", async () => {
        expect(
            await run('10 PRINT USING "##"; 1;', '20 PRINT "X"', "RUN"),
        ).toBe(" 1X\n");
    });

    it("takes its format from a variable", async () => {
        expect(
            await run('10 F$="$$##.##"', "20 PRINT USING F$; 9.5", "RUN"),
        ).toBe("  $9.50\n");
    });

    it("prints a table from one format", async () => {
        expect(await run('10 PRINT USING "## "; 1,2,3,4', "RUN")).toBe(
            " 1  2  3  4 \n",
        );
    });
});
