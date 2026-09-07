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

    it("stops as soon as the values run out", () => {
        expect(printUsing("## ##", [1])).toBe(" 1 ");
    });
});

describe("from a program", () => {
    it("prints a formatted line", async () => {
        expect(
            await run('10 PRINT USING "###.##"; 3.14159', "RUN"),
        ).toBe("  3.14\n");
    });

    it("takes several values", async () => {
        expect(
            await run('10 PRINT USING "## ## ##"; 1,2,3', "RUN"),
        ).toBe(" 1  2  3\n");
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
        expect(
            await run(
                '10 PRINT USING "## "; 1,2,3,4',
                "RUN",
            ),
        ).toBe(" 1  2  3  4 \n");
    });
});
