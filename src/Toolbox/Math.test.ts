import { describe, expect, test } from "vitest";
import { wrapMax, clamp } from "./Math";

describe("Math", () => {
  describe("wrapMax", () => {
    test("value within range is unchanged", () => {
      expect(wrapMax(0, 5)).toBe(0);
      expect(wrapMax(3, 5)).toBe(3);
      expect(wrapMax(4, 5)).toBe(4);
    });

    test("value at or above max wraps", () => {
      expect(wrapMax(5, 5)).toBe(0);
      expect(wrapMax(7, 5)).toBe(2);
      expect(wrapMax(10, 5)).toBe(0);
    });

    test("negative value wraps forward", () => {
      expect(wrapMax(-1, 5)).toBe(4);
      expect(wrapMax(-5, 5)).toBe(0);
      expect(wrapMax(-7, 5)).toBe(3);
    });
  });

  describe("clamp", () => {
    test("value within range is unchanged", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    test("value below min clamps to min", () => {
      expect(clamp(-1, 0, 10)).toBe(0);
    });

    test("value above max clamps to max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    test("value at boundaries is unchanged", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    test("min equals max", () => {
      expect(clamp(5, 5, 5)).toBe(5);
      expect(clamp(0, 5, 5)).toBe(5);
      expect(clamp(10, 5, 5)).toBe(5);
    });
  });
});
