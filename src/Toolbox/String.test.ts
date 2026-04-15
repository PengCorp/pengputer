import { describe, expect, test } from "vitest";
import { splitStringIntoCharacters, getStringLength } from "./String";

describe("String", () => {
    describe("splitStringIntoCharacters", () => {
        test("splits ASCII string into characters", () => {
            expect(splitStringIntoCharacters("abc")).toStrictEqual([
                "a",
                "b",
                "c",
            ]);
        });

        test("empty string returns empty array", () => {
            expect(splitStringIntoCharacters("")).toStrictEqual([]);
        });

        test("splits CRLF into separate CR and LF", () => {
            expect(splitStringIntoCharacters("\r\n")).toStrictEqual([
                "\r",
                "\n",
            ]);
        });

        test("preserves standalone LF", () => {
            expect(splitStringIntoCharacters("\n")).toStrictEqual(["\n"]);
        });

        test("handles emoji as single grapheme", () => {
            expect(splitStringIntoCharacters("a😀b")).toStrictEqual([
                "a",
                "😀",
                "b",
            ]);
        });
    });

    describe("getStringLength", () => {
        test("ASCII string length", () => {
            expect(getStringLength("hello")).toBe(5);
        });

        test("empty string is zero", () => {
            expect(getStringLength("")).toBe(0);
        });

        test("emoji counts as one", () => {
            expect(getStringLength("😀")).toBe(1);
        });

        test("CRLF counts as two", () => {
            expect(getStringLength("\r\n")).toBe(2);
        });
    });
});
