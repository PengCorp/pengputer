import { describe, expect, test } from "vitest";
import {
    assert,
    assertIsNull,
    assertIsNotNull,
    assertIsNil,
    assertIsNotNil,
    assertIsUndefined,
    assertIsDefined,
    assertIsTrue,
    assertIsFalse,
} from "./assert";

describe("assert", () => {
    test("assert passes on truthy values", () => {
        expect(() => assert(true)).not.toThrow();
        expect(() => assert(1)).not.toThrow();
        expect(() => assert("hello")).not.toThrow();
    });

    test("assert throws on falsy values", () => {
        expect(() => assert(false)).toThrow("Assertion failed");
        expect(() => assert(0)).toThrow("Assertion failed");
        expect(() => assert("")).toThrow("Assertion failed");
        expect(() => assert(null)).toThrow("Assertion failed");
        expect(() => assert(undefined)).toThrow("Assertion failed");
    });

    test("assert includes reason in error message", () => {
        expect(() => assert(false, "something went wrong")).toThrow(
            "Assertion failed: something went wrong",
        );
    });

    test("assertIsNull", () => {
        expect(() => assertIsNull(null)).not.toThrow();
        expect(() => assertIsNull(undefined)).toThrow();
        expect(() => assertIsNull(0)).toThrow();
    });

    test("assertIsNotNull", () => {
        expect(() => assertIsNotNull("hello")).not.toThrow();
        expect(() => assertIsNotNull(undefined)).not.toThrow();
        expect(() => assertIsNotNull(null)).toThrow();
    });

    test("assertIsNil", () => {
        expect(() => assertIsNil(null)).not.toThrow();
        expect(() => assertIsNil(undefined)).not.toThrow();
        expect(() => assertIsNil(0)).toThrow();
        expect(() => assertIsNil("")).toThrow();
    });

    test("assertIsNotNil", () => {
        expect(() => assertIsNotNil("hello")).not.toThrow();
        expect(() => assertIsNotNil(0)).not.toThrow();
        expect(() => assertIsNotNil(null)).toThrow();
        expect(() => assertIsNotNil(undefined)).toThrow();
    });

    test("assertIsUndefined", () => {
        expect(() => assertIsUndefined(undefined)).not.toThrow();
        expect(() => assertIsUndefined(null)).toThrow();
        expect(() => assertIsUndefined(0)).toThrow();
    });

    test("assertIsDefined", () => {
        expect(() => assertIsDefined(null)).not.toThrow();
        expect(() => assertIsDefined(0)).not.toThrow();
        expect(() => assertIsDefined("")).not.toThrow();
        expect(() => assertIsDefined(undefined)).toThrow();
    });

    test("assertIsTrue is strict", () => {
        expect(() => assertIsTrue(true)).not.toThrow();
        expect(() => assertIsTrue(false)).toThrow();
        expect(() => assertIsTrue(1)).toThrow();
        expect(() => assertIsTrue("true")).toThrow();
    });

    test("assertIsFalse is strict", () => {
        expect(() => assertIsFalse(false)).not.toThrow();
        expect(() => assertIsFalse(true)).toThrow();
        expect(() => assertIsFalse(0)).toThrow();
        expect(() => assertIsFalse("")).toThrow();
    });
});
