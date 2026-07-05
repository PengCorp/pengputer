import { describe, expect, test } from "vitest";
import { FileSystem } from "./FileSystem";
import { FilePath } from "./FilePath";
import { FileSystemObjectType } from "./types";
import { TransientFileSystemDrive } from "./drives";

function path(input: string): FilePath {
    return FilePath.tryParse(input)!;
}

describe("FileSystem mounting", () => {
    test("mounts C as a read-only transient drive out of the box", () => {
        const fs = new FileSystem();
        expect(fs.isMounted("C")).toBe(true);
        expect(fs.getDrive("C")!.readOnly).toBe(true);
    });

    test("mount refuses a drive letter that's already occupied", () => {
        const fs = new FileSystem();
        expect(fs.mount("C", new TransientFileSystemDrive(false))).toBe(false);
    });

    test("mount succeeds for a free drive letter", () => {
        const fs = new FileSystem();
        expect(fs.mount("D", new TransientFileSystemDrive(false))).toBe(true);
        expect(fs.isMounted("D")).toBe(true);
    });

    test("unmount frees the drive letter back up", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.unmount("D");
        expect(fs.isMounted("D")).toBe(false);
        expect(fs.mount("D", new TransientFileSystemDrive(false))).toBe(true);
    });

    test("getDrive returns undefined for a drive letter that was never mounted", () => {
        const fs = new FileSystem();
        expect(fs.getDrive("Z")).toBeUndefined();
    });
});

describe("FileSystem#listDrives", () => {
    test("lists C as a fixed, SYSTEM-labeled drive by default", () => {
        const fs = new FileSystem();
        expect(fs.listDrives()).toStrictEqual([
            { label: "C", drive: fs.getDrive("C") },
        ]);
        expect(fs.getDrive("C")!.kind).toBe("Fixed");
        expect(fs.getDrive("C")!.label).toBe("SYSTEM");
    });

    test("includes newly mounted drives, sorted by label", () => {
        const fs = new FileSystem();
        fs.mount("E", new TransientFileSystemDrive(false, "SCRATCH1"));
        fs.mount("D", new TransientFileSystemDrive(false, "SCRATCH2"));

        expect(fs.listDrives().map((m) => m.label)).toStrictEqual([
            "C",
            "D",
            "E",
        ]);
    });

    test("drops a drive from the listing once unmounted", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.unmount("D");

        expect(fs.listDrives().map((m) => m.label)).toStrictEqual(["C"]);
    });
});

describe("FileSystem#summarizeDrive", () => {
    test("counts zero dirs and files on a fresh drive", () => {
        const fs = new FileSystem();
        expect(fs.summarizeDrive("C")).toStrictEqual({
            directoryCount: 0,
            fileCount: 0,
        });
    });

    test("counts directories and files recursively", () => {
        const fs = new FileSystem();
        const drive = new TransientFileSystemDrive(false);
        fs.mount("D", drive);

        fs.createDirectory(path("D:/a/b"));
        drive.rootEntry.addItem({
            type: FileSystemObjectType.TextFile,
            name: "root.txt",
            data: { getText: () => "" } as never,
        });
        drive.rootEntry.mkdir("c").addItem({
            type: FileSystemObjectType.TextFile,
            name: "nested.txt",
            data: { getText: () => "" } as never,
        });

        // dirs: a, a/b, c => 3. files: root.txt, c/nested.txt => 2.
        // "a" and "b" were already created via createDirectory above; "c" adds a third.
        expect(fs.summarizeDrive("D")).toStrictEqual({
            directoryCount: 3,
            fileCount: 2,
        });
    });

    test("returns null for a drive that isn't mounted", () => {
        const fs = new FileSystem();
        expect(fs.summarizeDrive("Z")).toBeNull();
    });
});

describe("FileSystem#getFileInfo", () => {
    test("returns a drive's root directory", () => {
        const fs = new FileSystem();
        const entry = fs.getFileInfo(path("C:/"));
        expect(entry!.type).toBe(FileSystemObjectType.Directory);
    });

    test("walks nested directories that exist", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/foo/bar"));

        const entry = fs.getFileInfo(path("D:/foo/bar"));
        expect(entry!.type).toBe(FileSystemObjectType.Directory);
        expect((entry as { name: string }).name).toBe("bar");
    });

    test("returns null once the walk falls off a missing segment", () => {
        const fs = new FileSystem();
        expect(fs.getFileInfo(path("C:/nope"))).toBeNull();
    });

    test("returns null when descending through something that isn't a directory", () => {
        const fs = new FileSystem();
        const drive = new TransientFileSystemDrive(false);
        fs.mount("D", drive);
        drive.rootEntry.addItem({
            type: FileSystemObjectType.TextFile,
            name: "foo",
            data: { getText: () => "" } as never,
        });

        // "foo" is a file, so a path that tries to go through it must fail
        expect(fs.getFileInfo(path("D:/foo/bar"))).toBeNull();
    });

    test("returns null for a drive that isn't mounted", () => {
        const fs = new FileSystem();
        expect(fs.getFileInfo(path("Z:/"))).toBeNull();
    });

    test("returns null for a driveless path", () => {
        const fs = new FileSystem();
        expect(fs.getFileInfo(path("/foo"))).toBeNull();
    });
});

describe("FileSystem#createDirectory", () => {
    test("creates every missing segment along the path", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/a/b/c"));

        expect(fs.getFileInfo(path("D:/a"))!.type).toBe(
            FileSystemObjectType.Directory,
        );
        expect(fs.getFileInfo(path("D:/a/b/c"))!.type).toBe(
            FileSystemObjectType.Directory,
        );
    });

    test("is idempotent when segments already exist as directories", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));
        expect(() => fs.createDirectory(path("D:/a/b/c"))).not.toThrow();
    });

    test("refuses to descend through a non-directory entry", () => {
        const fs = new FileSystem();
        const drive = new TransientFileSystemDrive(false);
        fs.mount("D", drive);
        drive.rootEntry.addItem({
            type: FileSystemObjectType.TextFile,
            name: "a",
            data: { getText: () => "" } as never,
        });

        expect(() => fs.createDirectory(path("D:/a/b"))).toThrow(
            /a is not a directory/,
        );
    });

    test("throws when the target drive is read-only", () => {
        const fs = new FileSystem();
        expect(() => fs.createDirectory(path("C:/stuff"))).toThrow(/read-only/);
    });

    test("throws when the target drive isn't mounted at all", () => {
        const fs = new FileSystem();
        expect(() => fs.createDirectory(path("Z:/stuff"))).toThrow(
            /not mounted/,
        );
    });
});

describe("FileSystem#removeDirectory", () => {
    test("removes an empty directory", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        fs.removeDirectory(path("D:/a/b"));
        expect(fs.getFileInfo(path("D:/a/b"))).toBeNull();
        expect(fs.getFileInfo(path("D:/a"))).not.toBeNull();
    });

    test("refuses to remove a non-empty directory without force", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        expect(() => fs.removeDirectory(path("D:/a"))).toThrow(/not empty/);
        expect(fs.getFileInfo(path("D:/a"))).not.toBeNull();
    });

    test("removes a non-empty directory when forced", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        fs.removeDirectory(path("D:/a"), true);
        expect(fs.getFileInfo(path("D:/a"))).toBeNull();
    });

    test("treats removing a drive's own root as a no-op", () => {
        const fs = new FileSystem();
        fs.mount("D", new TransientFileSystemDrive(false));
        expect(() => fs.removeDirectory(path("D:/"))).not.toThrow();
        expect(fs.getFileInfo(path("D:/"))).not.toBeNull();
    });

    test("throws when the target drive is read-only", () => {
        const fs = new FileSystem();
        expect(() => fs.removeDirectory(path("C:/stuff"))).toThrow(/read-only/);
    });
});
