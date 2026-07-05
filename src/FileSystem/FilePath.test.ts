import { describe, expect, test } from "vitest";
import { FilePath } from "./FilePath";

describe("FilePath.tryParse", () => {
    test("parses an empty string as a relative, driveless, empty path", () => {
        const p = FilePath.tryParse("");
        expect(p).not.toBeNull();
        expect(p!.drive).toBeNull();
        expect(p!.pieces).toStrictEqual([]);
        expect(p!.isRelative()).toBe(true);
    });

    test("parses a bare slash as the driveless root", () => {
        const p = FilePath.tryParse("/");
        expect(p).not.toBeNull();
        expect(p!.drive).toBeNull();
        expect(p!.pieces).toStrictEqual([]);
        expect(p!.isAbsolute()).toBe(true);
    });

    test("parses a drive letter with no path as that drive's root", () => {
        const p = FilePath.tryParse("C:");
        expect(p!.drive).toBe("C");
        expect(p!.pieces).toStrictEqual([]);
        expect(p!.isAbsolute()).toBe(true);
    });

    test("parses a fully qualified path", () => {
        const p = FilePath.tryParse("C:/foo/bar");
        expect(p!.drive).toBe("C");
        expect(p!.pieces).toStrictEqual(["foo", "bar"]);
        expect(p!.isAbsolute()).toBe(true);
    });

    test("parses a driveless relative path", () => {
        const p = FilePath.tryParse("foo/bar");
        expect(p!.drive).toBeNull();
        expect(p!.pieces).toStrictEqual(["foo", "bar"]);
        expect(p!.isRelative()).toBe(true);
    });

    test("parses a driveless absolute path", () => {
        const p = FilePath.tryParse("/foo/bar");
        expect(p!.drive).toBeNull();
        expect(p!.pieces).toStrictEqual(["foo", "bar"]);
        expect(p!.isAbsolute()).toBe(true);
    });

    test("uppercases the drive letter", () => {
        expect(FilePath.tryParse("c:/foo")!.drive).toBe("C");
    });

    test("rejects a drive prefix that isn't a real drive letter", () => {
        expect(FilePath.tryParse("1:")).toBeNull();
        expect(FilePath.tryParse("AB:")).toBeNull();
    });

    test("drops '.' segments", () => {
        expect(FilePath.tryParse("/foo/./bar")!.pieces).toStrictEqual([
            "foo",
            "bar",
        ]);
    });

    test("resolves '..' against the previous segment on an absolute path", () => {
        expect(FilePath.tryParse("/foo/../bar")!.pieces).toStrictEqual(["bar"]);
        expect(FilePath.tryParse("/foo/bar/../../baz")!.pieces).toStrictEqual([
            "baz",
        ]);
    });

    test("swallows '..' that would climb above an absolute root", () => {
        const p = FilePath.tryParse("/../..");
        expect(p!.pieces).toStrictEqual([]);
        expect(p!.isAbsolute()).toBe(true);
    });

    test("keeps '..' literally on a relative path instead of resolving it", () => {
        const p = FilePath.tryParse("foo/../..");
        expect(p!.pieces).toStrictEqual(["foo", "..", ".."]);
        expect(p!.isRelative()).toBe(true);
    });

    test("applies the default drive to a rooted path with no explicit drive", () => {
        expect(FilePath.tryParse("/foo", "D")!.drive).toBe("D");
    });

    test("ignores the default drive for a relative path", () => {
        expect(FilePath.tryParse("foo", "D")!.drive).toBeNull();
    });
});

describe("FilePath#toString", () => {
    test("renders a drive-qualified path", () => {
        expect(FilePath.tryParse("C:/foo/bar")!.toString()).toBe("C:/foo/bar");
    });

    test("renders a driveless absolute path", () => {
        expect(FilePath.tryParse("/foo/bar")!.toString()).toBe("/foo/bar");
    });

    test("renders a relative path with a leading './'", () => {
        expect(FilePath.tryParse("foo/bar")!.toString()).toBe("./foo/bar");
    });

    test("renders the driveless root as '/'", () => {
        expect(FilePath.tryParse("/")!.toString()).toBe("/");
    });

    test("renders a drive root with a trailing slash", () => {
        expect(FilePath.tryParse("C:")!.toString()).toBe("C:/");
    });
});

describe("FilePath#equals", () => {
    test("is true for two paths with the same drive and pieces", () => {
        expect(
            FilePath.tryParse("C:/foo/bar")!.equals(
                FilePath.tryParse("C:/foo/bar")!,
            ),
        ).toBe(true);
    });

    test("is false when the drive differs", () => {
        expect(
            FilePath.tryParse("C:/foo")!.equals(FilePath.tryParse("D:/foo")!),
        ).toBe(false);
    });

    test("is false when the pieces differ", () => {
        expect(
            FilePath.tryParse("C:/foo")!.equals(FilePath.tryParse("C:/bar")!),
        ).toBe(false);
    });

    test("is false for a relative and an absolute path with the same pieces", () => {
        expect(
            FilePath.tryParse("foo")!.equals(FilePath.tryParse("/foo")!),
        ).toBe(false);
    });
});

describe("FilePath#combine", () => {
    test("appends a relative path's pieces onto the base", () => {
        const combined = FilePath.tryParse("C:/foo")!.combine(
            FilePath.tryParse("bar/baz")!,
        );
        expect(combined.drive).toBe("C");
        expect(combined.pieces).toStrictEqual(["foo", "bar", "baz"]);
    });

    test("an absolute other path wins outright, discarding the base", () => {
        const base = FilePath.tryParse("C:/foo")!;
        const other = FilePath.tryParse("D:/bar")!;
        expect(base.combine(other)).toBe(other);
    });
});

describe("FilePath#parentDirectory", () => {
    test("drops the last segment", () => {
        expect(
            FilePath.tryParse("C:/foo/bar")!.parentDirectory().pieces,
        ).toStrictEqual(["foo"]);
    });

    test("is a no-op at a drive's root", () => {
        const root = FilePath.tryParse("C:/")!;
        const parent = root.parentDirectory();
        expect(parent.pieces).toStrictEqual([]);
        expect(parent.drive).toBe("C");
    });

    test("reduces a single-segment relative path to empty", () => {
        expect(
            FilePath.tryParse("foo")!.parentDirectory().pieces,
        ).toStrictEqual([]);
    });
});

describe("FilePath#hasDrive", () => {
    test("is true once a drive letter was parsed", () => {
        expect(FilePath.tryParse("C:/foo")!.hasDrive()).toBe(true);
    });

    test("is false for a driveless path", () => {
        expect(FilePath.tryParse("/foo")!.hasDrive()).toBe(false);
    });
});
