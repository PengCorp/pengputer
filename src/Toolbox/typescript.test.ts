import { describe, expect, test } from "vitest";
import { isNil, safeAt, safeAtKey } from "./typescript";

describe("typescript", () => {
    describe("isNil", () => {
        test("returns true for null and undefined", () => {
            expect(isNil(null)).toBe(true);
            expect(isNil(undefined)).toBe(true);
        });

        test("returns false for falsy non-nil values", () => {
            expect(isNil(0)).toBe(false);
            expect(isNil("")).toBe(false);
            expect(isNil(false)).toBe(false);
        });
    });

    describe("safeAt", () => {
        test("returns element at valid index", () => {
            expect(safeAt([10, 20, 30], 0)).toBe(10);
            expect(safeAt([10, 20, 30], 2)).toBe(30);
        });

        test("throws on negative index", () => {
            expect(() => safeAt([10], -1)).toThrow("out of bounds");
        });

        test("throws on out-of-bounds index", () => {
            expect(() => safeAt([10], 1)).toThrow("out of bounds");
            expect(() => safeAt([], 0)).toThrow("out of bounds");
        });

        test("throws on sparse array gap", () => {
            const arr: unknown[] = [];
            arr[2] = "x";
            expect(() => safeAt(arr, 0)).toThrow("unassigned");
            expect(safeAt(arr, 2)).toBe("x");
        });
    });

    describe("safeAtKey", () => {
        test("returns value for existing key", () => {
            expect(safeAtKey({ a: 1, b: 2 }, "a")).toBe(1);
        });

        test("throws on missing key", () => {
            const obj: Record<string, number> = { a: 1 };
            expect(() => safeAtKey(obj, "b")).toThrow("unassigned");
        });

        test("throws on empty object", () => {
            const obj: Record<string, number> = {};
            expect(() => safeAtKey(obj, "x")).toThrow("unassigned");
        });
    });
});
