import { describe, expect, test } from "vitest";
import { FilePath } from "./FilePath";

describe("FilePath", () => {
  describe("tryParse", () => {
    test("empty string", () => {
      const p = FilePath.tryParse("");
      expect(p).not.toBeNull();
      expect(p!.drive).toBeNull();
      expect(p!.pieces).toStrictEqual([]);
      expect(p!.isAbsolute()).toBe(false);
    });

    test("root path", () => {
      const p = FilePath.tryParse("/");
      expect(p).not.toBeNull();
      expect(p!.drive).toBeNull();
      expect(p!.pieces).toStrictEqual([]);
      expect(p!.isAbsolute()).toBe(true);
    });

    test("drive-only path", () => {
      const p = FilePath.tryParse("C:");
      expect(p).not.toBeNull();
      expect(p!.drive).toBe("C");
      expect(p!.pieces).toStrictEqual([]);
      expect(p!.isAbsolute()).toBe(true);
    });

    test("absolute path with drive", () => {
      const p = FilePath.tryParse("C:/foo/bar");
      expect(p).not.toBeNull();
      expect(p!.drive).toBe("C");
      expect(p!.pieces).toStrictEqual(["foo", "bar"]);
      expect(p!.isAbsolute()).toBe(true);
    });

    test("relative path", () => {
      const p = FilePath.tryParse("foo/bar");
      expect(p).not.toBeNull();
      expect(p!.drive).toBeNull();
      expect(p!.pieces).toStrictEqual(["foo", "bar"]);
      expect(p!.isRelative()).toBe(true);
    });

    test("absolute path without drive", () => {
      const p = FilePath.tryParse("/foo/bar");
      expect(p).not.toBeNull();
      expect(p!.drive).toBeNull();
      expect(p!.pieces).toStrictEqual(["foo", "bar"]);
      expect(p!.isAbsolute()).toBe(true);
    });

    test("lowercase drive is uppercased", () => {
      const p = FilePath.tryParse("c:/foo");
      expect(p).not.toBeNull();
      expect(p!.drive).toBe("C");
    });

    test("invalid drive label returns null", () => {
      expect(FilePath.tryParse("1:")).toBeNull();
      expect(FilePath.tryParse("AB:")).toBeNull();
    });

    test("dot is removed", () => {
      const p = FilePath.tryParse("/foo/./bar");
      expect(p!.pieces).toStrictEqual(["foo", "bar"]);
    });

    test("dotdot pops previous piece", () => {
      const p = FilePath.tryParse("/foo/../bar");
      expect(p!.pieces).toStrictEqual(["bar"]);
    });

    test("multi-level dotdot", () => {
      const p = FilePath.tryParse("/foo/bar/../../baz");
      expect(p!.pieces).toStrictEqual(["baz"]);
    });

    test("dotdot past root on absolute path stops silently", () => {
      const p = FilePath.tryParse("/../..");
      expect(p!.pieces).toStrictEqual([]);
      expect(p!.isAbsolute()).toBe(true);
    });

    test("dotdot on relative path always pushes (never pops)", () => {
      const p = FilePath.tryParse("foo/../..");
      expect(p!.pieces).toStrictEqual(["foo", "..", ".."]);
      expect(p!.isRelative()).toBe(true);
    });

    test("defaultDrive used for absolute paths without explicit drive", () => {
      const p = FilePath.tryParse("/foo", "D" as any);
      expect(p!.drive).toBe("D");
    });

    test("defaultDrive not used for relative paths", () => {
      const p = FilePath.tryParse("foo", "D" as any);
      expect(p!.drive).toBeNull();
    });
  });

  describe("toString", () => {
    test("absolute with drive", () => {
      expect(FilePath.tryParse("C:/foo/bar")!.toString()).toBe("C:/foo/bar");
    });

    test("absolute without drive", () => {
      expect(FilePath.tryParse("/foo/bar")!.toString()).toBe("/foo/bar");
    });

    test("relative path", () => {
      expect(FilePath.tryParse("foo/bar")!.toString()).toBe("./foo/bar");
    });

    test("root", () => {
      expect(FilePath.tryParse("/")!.toString()).toBe("/");
    });

    test("drive-only", () => {
      expect(FilePath.tryParse("C:")!.toString()).toBe("C:/");
    });
  });

  describe("equals", () => {
    test("same path is equal", () => {
      const a = FilePath.tryParse("C:/foo/bar")!;
      const b = FilePath.tryParse("C:/foo/bar")!;
      expect(a.equals(b)).toBe(true);
    });

    test("different drive is not equal", () => {
      const a = FilePath.tryParse("C:/foo")!;
      const b = FilePath.tryParse("D:/foo")!;
      expect(a.equals(b)).toBe(false);
    });

    test("different pieces is not equal", () => {
      const a = FilePath.tryParse("C:/foo")!;
      const b = FilePath.tryParse("C:/bar")!;
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("combine", () => {
    test("combines absolute with relative", () => {
      const base = FilePath.tryParse("C:/foo")!;
      const rel = FilePath.tryParse("bar/baz")!;
      const combined = base.combine(rel);
      expect(combined.pieces).toStrictEqual(["foo", "bar", "baz"]);
      expect(combined.drive).toBe("C");
    });

    test("absolute other returns this (not other)", () => {
      const a = FilePath.tryParse("C:/foo")!;
      const b = FilePath.tryParse("D:/bar")!;
      const result = a.combine(b);
      expect(result).toBe(a);
    });
  });

  describe("parentDirectory", () => {
    test("returns parent", () => {
      const p = FilePath.tryParse("C:/foo/bar")!.parentDirectory();
      expect(p.pieces).toStrictEqual(["foo"]);
    });

    test("root parent is root", () => {
      const p = FilePath.tryParse("C:/")!.parentDirectory();
      expect(p.pieces).toStrictEqual([]);
      expect(p.drive).toBe("C");
    });

    test("single piece parent has no pieces", () => {
      const p = FilePath.tryParse("foo")!.parentDirectory();
      expect(p.pieces).toStrictEqual([]);
    });
  });

  describe("hasDrive", () => {
    test("true when drive present", () => {
      expect(FilePath.tryParse("C:/foo")!.hasDrive()).toBe(true);
    });

    test("false when no drive", () => {
      expect(FilePath.tryParse("/foo")!.hasDrive()).toBe(false);
    });
  });
});
