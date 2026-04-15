import { describe, expect, test } from "vitest";
import { argparse } from "./argparse";

describe("argparse", () => {
    test("empty string returns empty array", () => {
        expect(argparse("")).toStrictEqual([]);
    });

    test("single token", () => {
        expect(argparse("hello")).toStrictEqual(["hello"]);
    });

    test("multiple tokens", () => {
        expect(argparse("hello world")).toStrictEqual(["hello", "world"]);
        expect(argparse("a b c")).toStrictEqual(["a", "b", "c"]);
    });

    test("extra whitespace is trimmed", () => {
        expect(argparse("  hello  world  ")).toStrictEqual(["hello", "world"]);
        expect(argparse("   ")).toStrictEqual([]);
    });

    test("quoted string preserves spaces", () => {
        expect(argparse('"hello world"')).toStrictEqual(["hello world"]);
    });

    test("multiple quoted strings", () => {
        expect(argparse('"hello" "world"')).toStrictEqual(["hello", "world"]);
    });

    test("mixed quoted and unquoted", () => {
        expect(argparse('a "b c" d')).toStrictEqual(["a", "b c", "d"]);
    });

    test("empty quoted string", () => {
        expect(argparse('""')).toStrictEqual([""]);
    });

    test("unclosed quote parses until end", () => {
        expect(argparse('"hello')).toStrictEqual(["hello"]);
    });

    test("escaped space in unquoted token", () => {
        expect(argparse("hello\\ world")).toStrictEqual(["hello world"]);
    });

    test("escaped quote outside quotes", () => {
        expect(argparse('hello\\"world')).toStrictEqual(['hello"world']);
    });

    test("escaped backslash", () => {
        expect(argparse("hello\\\\world")).toStrictEqual(["hello\\world"]);
    });

    test("escaped quote inside quotes", () => {
        expect(argparse('"hello\\"world"')).toStrictEqual(['hello"world']);
    });

    test("escaped backslash inside quotes", () => {
        expect(argparse('"hello\\\\"')).toStrictEqual(["hello\\"]);
    });

    test("throws on trailing escape backslash", () => {
        expect(() => argparse("hello\\")).toThrow("Trailing escape character");
    });

    test("consecutive spaces between tokens", () => {
        expect(argparse("a  b  c")).toStrictEqual(["a", "b", "c"]);
    });
});
