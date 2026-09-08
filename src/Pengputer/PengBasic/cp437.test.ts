import { describe, expect, it } from "vitest";
import { characterForCode, codeForCharacter } from "./cp437";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

async function value(expr: string): Promise<string> {
    const machine = new TestConsole();
    const interpreter = new Interpreter(machine);
    await interpreter.executeLine(`PRINT ${expr}`);
    return machine.getText();
}

describe("the character ROM", () => {
    it("gives blocks and shades where a PC would", () => {
        expect(characterForCode(176)).toBe("░");
        expect(characterForCode(177)).toBe("▒");
        expect(characterForCode(178)).toBe("▓");
        expect(characterForCode(219)).toBe("█");
        expect(characterForCode(223)).toBe("▀");
    });

    it("gives box corners", () => {
        expect(characterForCode(218)).toBe("┌");
        expect(characterForCode(191)).toBe("┐");
        expect(characterForCode(192)).toBe("└");
        expect(characterForCode(217)).toBe("┘");
        expect(characterForCode(196)).toBe("─");
        expect(characterForCode(179)).toBe("│");
    });

    it("is not Latin-1", () => {
        /* String.fromCharCode(176) would be the degree sign. */
        expect(characterForCode(176)).not.toBe(String.fromCharCode(176));
        expect(characterForCode(248)).toBe("°");
    });

    it("leaves ASCII where it belongs", () => {
        expect(characterForCode(65)).toBe("A");
        expect(characterForCode(32)).toBe(" ");
        expect(characterForCode(34)).toBe('"');
    });

    it("keeps the control codes as controls", () => {
        expect(characterForCode(10)).toBe("\n");
        expect(characterForCode(13)).toBe("\r");
        expect(characterForCode(9)).toBe("\t");
    });

    it("still draws the card suits, which are not controls", () => {
        expect(characterForCode(3)).toBe("♥︎");
        expect(characterForCode(6)).toBe("♠︎");
    });

    it("round-trips", () => {
        for (const code of [32, 65, 176, 178, 200, 219, 254]) {
            expect(codeForCharacter(characterForCode(code))).toBe(code);
        }
    });

    it('answers ASC(" ") with 32, not 0', () => {
        /* A blank is drawn at 0, 32 and 255; only one of them is right. */
        expect(codeForCharacter(" ")).toBe(32);
    });
});

describe("from a program", () => {
    it("CHR$ draws a block", async () => {
        expect(await value("CHR$(219)")).toBe("█\n");
    });

    it("ASC reverses it", async () => {
        expect(await value("ASC(CHR$(176))")).toBe(" 176 \n");
    });

    it("STRING$ takes a code from the same ROM", async () => {
        expect(await value("STRING$(3,178)")).toBe("▓▓▓\n");
    });

    it("CHR$(34) is still a quote", async () => {
        expect(await value("CHR$(34)")).toBe('"\n');
    });
});
