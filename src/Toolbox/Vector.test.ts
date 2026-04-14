import { describe, expect, test } from "vitest";
import {
  vectorAdd,
  vectorSubtract,
  vectorEqual,
  vectorClone,
  vectorDotProduct,
  vectorReflect,
  vectorDivideByNumberFloored,
  vectorMultiplyComponents,
  vectorDivideComponents,
  vectorClamp,
  getDoesPointIntersectRect,
  getDoRectsIntersect,
  getDoRectsTouch,
  getRectWithPosition,
  getRectMovedBy,
  compareRectsX,
  compareRectsY,
  getUnitCircleVector,
} from "./Vector";

describe("Vector", () => {
  describe("vectorAdd", () => {
    test("adds components", () => {
      expect(vectorAdd({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual({
        x: 4,
        y: 6,
      });
    });

    test("handles negatives", () => {
      expect(vectorAdd({ x: -1, y: 3 }, { x: 1, y: -3 })).toStrictEqual({
        x: 0,
        y: 0,
      });
    });
  });

  describe("vectorSubtract", () => {
    test("subtracts components", () => {
      expect(vectorSubtract({ x: 5, y: 7 }, { x: 2, y: 3 })).toStrictEqual({
        x: 3,
        y: 4,
      });
    });
  });

  describe("vectorEqual", () => {
    test("equal vectors", () => {
      expect(vectorEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    });

    test("unequal vectors", () => {
      expect(vectorEqual({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
    });
  });

  describe("vectorClone", () => {
    test("returns a copy", () => {
      const v = { x: 3, y: 4 };
      const c = vectorClone(v);
      expect(c).toStrictEqual(v);
      expect(c).not.toBe(v);
    });
  });

  describe("vectorDotProduct", () => {
    test("computes dot product", () => {
      expect(vectorDotProduct({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
    });

    test("perpendicular vectors give zero", () => {
      expect(vectorDotProduct({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    });
  });

  describe("vectorReflect", () => {
    test("reflects off horizontal surface", () => {
      const result = vectorReflect({ x: 1, y: -1 }, { x: 0, y: 1 });
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(1);
    });

    test("reflects off vertical surface", () => {
      const result = vectorReflect({ x: -1, y: 1 }, { x: 1, y: 0 });
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(1);
    });
  });

  describe("vectorDivideByNumberFloored", () => {
    test("divides and floors", () => {
      expect(vectorDivideByNumberFloored({ x: 7, y: 9 }, 2)).toStrictEqual({
        x: 3,
        y: 4,
      });
    });
  });

  describe("vectorMultiplyComponents", () => {
    test("multiplies component-wise", () => {
      expect(
        vectorMultiplyComponents({ x: 2, y: 3 }, { x: 4, y: 5 }),
      ).toStrictEqual({ x: 8, y: 15 });
    });
  });

  describe("vectorDivideComponents", () => {
    test("divides component-wise and floors", () => {
      expect(
        vectorDivideComponents({ x: 7, y: 10 }, { x: 2, y: 3 }),
      ).toStrictEqual({ x: 3, y: 3 });
    });
  });

  describe("vectorClamp", () => {
    test("inside rect unchanged", () => {
      expect(vectorClamp({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toStrictEqual({ x: 5, y: 5 });
    });

    test("clamps to rect bounds", () => {
      expect(vectorClamp({ x: -5, y: 20 }, { x: 0, y: 0, w: 10, h: 10 })).toStrictEqual({ x: 0, y: 9 });
    });
  });

  describe("getDoesPointIntersectRect", () => {
    test("point inside rect", () => {
      expect(getDoesPointIntersectRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    });

    test("point on edge is outside (strict comparison)", () => {
      expect(getDoesPointIntersectRect({ x: 0, y: 0 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
      expect(getDoesPointIntersectRect({ x: 10, y: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
    });

    test("point outside rect", () => {
      expect(getDoesPointIntersectRect({ x: 15, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
    });
  });

  describe("getDoRectsIntersect", () => {
    test("overlapping rects", () => {
      expect(getDoRectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    });

    test("non-overlapping rects", () => {
      expect(getDoRectsIntersect({ x: 0, y: 0, w: 5, h: 5 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(false);
    });

    test("sharing an edge does not intersect", () => {
      expect(getDoRectsIntersect({ x: 0, y: 0, w: 5, h: 5 }, { x: 5, y: 0, w: 5, h: 5 })).toBe(false);
      expect(getDoRectsIntersect({ x: 5, y: 0, w: 5, h: 5 }, { x: 0, y: 0, w: 5, h: 5 })).toBe(false);
    });

    test("rect contained inside another", () => {
      expect(getDoRectsIntersect({ x: 0, y: 0, w: 20, h: 20 }, { x: 5, y: 5, w: 5, h: 5 })).toBe(true);
    });
  });

  describe("getDoRectsTouch", () => {
    test("rects touching on top edge", () => {
      expect(getDoRectsTouch({ x: 0, y: 0, w: 10, h: 5 }, { x: 0, y: 5, w: 10, h: 5 })).toBe(true);
    });

    test("rects touching on left edge", () => {
      expect(getDoRectsTouch({ x: 0, y: 0, w: 5, h: 10 }, { x: 5, y: 0, w: 5, h: 10 })).toBe(true);
    });

    test("rects touching on right edge", () => {
      expect(getDoRectsTouch({ x: 5, y: 0, w: 5, h: 10 }, { x: 0, y: 0, w: 5, h: 10 })).toBe(true);
    });

    test("rects touching on bottom edge", () => {
      expect(getDoRectsTouch({ x: 0, y: 5, w: 10, h: 5 }, { x: 0, y: 0, w: 10, h: 5 })).toBe(true);
    });

    test("separated rects do not touch", () => {
      expect(getDoRectsTouch({ x: 0, y: 0, w: 5, h: 5 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(false);
    });

    test("overlapping rects do not touch", () => {
      expect(getDoRectsTouch({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(false);
    });
  });

  describe("getRectWithPosition", () => {
    test("moves rect to new position", () => {
      expect(getRectWithPosition({ x: 1, y: 2, w: 10, h: 20 }, { x: 5, y: 6 })).toStrictEqual({ x: 5, y: 6, w: 10, h: 20 });
    });
  });

  describe("getRectMovedBy", () => {
    test("offsets rect position", () => {
      expect(getRectMovedBy({ x: 1, y: 2, w: 10, h: 20 }, { x: 3, y: 4 })).toStrictEqual({ x: 4, y: 6, w: 10, h: 20 });
    });
  });

  describe("compareRectsX", () => {
    test("a left of b", () => {
      expect(compareRectsX({ x: 0, y: 0, w: 5, h: 5 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(-1);
    });

    test("a right of b", () => {
      expect(compareRectsX({ x: 10, y: 0, w: 5, h: 5 }, { x: 0, y: 0, w: 5, h: 5 })).toBe(1);
    });

    test("overlapping on X", () => {
      expect(compareRectsX({ x: 0, y: 0, w: 10, h: 5 }, { x: 5, y: 0, w: 10, h: 5 })).toBe(0);
    });
  });

  describe("compareRectsY", () => {
    test("a above b", () => {
      expect(compareRectsY({ x: 0, y: 0, w: 5, h: 5 }, { x: 0, y: 10, w: 5, h: 5 })).toBe(-1);
    });

    test("a below b", () => {
      expect(compareRectsY({ x: 0, y: 10, w: 5, h: 5 }, { x: 0, y: 0, w: 5, h: 5 })).toBe(1);
    });

    test("overlapping on Y", () => {
      expect(compareRectsY({ x: 0, y: 0, w: 5, h: 10 }, { x: 0, y: 5, w: 5, h: 10 })).toBe(0);
    });
  });

  describe("getUnitCircleVector", () => {
    test("angle 0 points right", () => {
      const v = getUnitCircleVector(0);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);
    });

    test("angle PI/2 points down", () => {
      const v = getUnitCircleVector(Math.PI / 2);
      expect(v.x).toBeCloseTo(0);
      expect(v.y).toBeCloseTo(1);
    });
  });
});
