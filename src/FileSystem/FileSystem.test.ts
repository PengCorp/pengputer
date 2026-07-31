import { describe, expect, test } from "vitest";
import { FileSystem } from "./FileSystem";
import { FilePath } from "./FilePath";
import { FileType, type DriveLetter } from "./types";
import { FileSystemDrive } from "./Drive";

function path(input: string): FilePath {
    return FilePath.tryParse(input)!;
}

// legacy
function mountDrive(fs: FileSystem, letter: DriveLetter, drive: FileSystemDrive): boolean {
    fs.registerDrive(drive);
    return fs.mount(letter, drive.label);
}

describe("FileSystem mounting", () => {
    test("mounts C as a read-only transient drive out of the box", () => {
        const fs = new FileSystem();
        expect(fs.isMounted("C")).toBe(true);
        expect(fs.getDriveByLetter("C")!.readOnly).toBe(true);
    });

    test("mount refuses a drive letter that's already occupied", () => {
        const fs = new FileSystem();
        expect(mountDrive(fs, "C", new FileSystemDrive(false))).toBe(false);
    });

    test("mount succeeds for a free drive letter", () => {
        const fs = new FileSystem();
        expect(mountDrive(fs, "D", new FileSystemDrive(false))).toBe(true);
        expect(fs.isMounted("D")).toBe(true);
    });

    test("unmount frees the drive letter back up", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.unmount("D");
        expect(fs.isMounted("D")).toBe(false);
        expect(mountDrive(fs, "D", new FileSystemDrive(false))).toBe(true);
    });

    test("getDrive returns undefined for a drive letter that was never mounted", () => {
        const fs = new FileSystem();
        expect(fs.getDriveByLetter("Z")).toBeNull();
    });
});

describe("FileSystem#listDrives", () => {
    test("lists C as a fixed, SYSTEM-labeled drive by default", () => {
        const fs = new FileSystem();
        expect(fs.listAllDrives()).toStrictEqual([
            { letter: "C", drive: fs.getDriveByLetter("C") },
        ]);
        expect(fs.getDriveByLetter("C")!.kind).toBe("Fixed");
        expect(fs.getDriveByLetter("C")!.label).toBe("SYSTEM");
    });

    test("includes newly mounted drives, sorted by label", () => {
        const fs = new FileSystem();
        mountDrive(fs, "E", new FileSystemDrive(false, "SCRATCH1"));
        mountDrive(fs, "D", new FileSystemDrive(false, "SCRATCH2"));

        expect(fs.listAllDrives().map((m) => m.letter)).toStrictEqual([
            "C",
            "D",
            "E",
        ]);
    });

    test("drops a drive from the listing once unmounted", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.unmount("D");

        expect(fs.listMountedDrives().map((m) => m.letter)).toStrictEqual(["C"]);
    });
});

describe("FileSystem#summarizeDrive", () => {
    test("counts zero dirs and files on a fresh drive", () => {
        const fs = new FileSystem();
        expect(fs.summarizeDriveByLetter("C")).toStrictEqual({
            directoryCount: 0,
            fileCount: 0,
        });
    });

    test("counts directories and files recursively", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false);
        mountDrive(fs, "D", drive);

        fs.createDirectory(path("D:/a/b"));
        drive.rootEntry.addItem({
            type: FileType.TextFile,
            name: "root.txt",
            data: { getText: () => "" } as never,
        });
        drive.rootEntry.mkdir("c").addItem({
            type: FileType.TextFile,
            name: "nested.txt",
            data: { getText: () => "" } as never,
        });

        // dirs: a, a/b, c => 3. files: root.txt, c/nested.txt => 2.
        // "a" and "b" were already created via createDirectory above; "c" adds a third.
        expect(fs.summarizeDriveByLetter("D")).toStrictEqual({
            directoryCount: 3,
            fileCount: 2,
        });
    });

    test("returns null for a drive that isn't mounted", () => {
        const fs = new FileSystem();
        expect(fs.summarizeDriveByLetter("Z")).toBeNull();
    });
});

describe("FileSystem#getFileInfo", () => {
    test("returns a drive's root directory", () => {
        const fs = new FileSystem();
        const entry = fs.getFileInfo(path("C:/"));
        expect(entry!.type).toBe(FileType.Directory);
    });

    test("walks nested directories that exist", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/foo/bar"));

        const entry = fs.getFileInfo(path("D:/foo/bar"));
        expect(entry!.type).toBe(FileType.Directory);
        expect((entry as { name: string }).name).toBe("bar");
    });

    test("returns null once the walk falls off a missing segment", () => {
        const fs = new FileSystem();
        expect(fs.getFileInfo(path("C:/nope"))).toBeNull();
    });

    test("returns null when descending through something that isn't a directory", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false);
        mountDrive(fs, "D", drive);
        drive.rootEntry.addItem({
            type: FileType.TextFile,
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
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/a/b/c"));

        expect(fs.getFileInfo(path("D:/a"))!.type).toBe(
            FileType.Directory,
        );
        expect(fs.getFileInfo(path("D:/a/b/c"))!.type).toBe(
            FileType.Directory,
        );
    });

    test("is idempotent when segments already exist as directories", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));
        expect(() => fs.createDirectory(path("D:/a/b/c"))).not.toThrow();
    });

    test("refuses to descend through a non-directory entry", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false);
        mountDrive(fs, "D", drive);
        drive.rootEntry.addItem({
            type: FileType.TextFile,
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
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        fs.removeDirectory(path("D:/a/b"));
        expect(fs.getFileInfo(path("D:/a/b"))).toBeNull();
        expect(fs.getFileInfo(path("D:/a"))).not.toBeNull();
    });

    test("refuses to remove a non-empty directory without force", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        expect(() => fs.removeDirectory(path("D:/a"))).toThrow(/not empty/);
        expect(fs.getFileInfo(path("D:/a"))).not.toBeNull();
    });

    test("removes a non-empty directory when forced", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        fs.createDirectory(path("D:/a/b"));

        fs.removeDirectory(path("D:/a"), true);
        expect(fs.getFileInfo(path("D:/a"))).toBeNull();
    });

    test("treats removing a drive's own root as a no-op", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));
        expect(() => fs.removeDirectory(path("D:/"))).not.toThrow();
        expect(fs.getFileInfo(path("D:/"))).not.toBeNull();
    });

    test("throws when the target drive is read-only", () => {
        const fs = new FileSystem();
        expect(() => fs.removeDirectory(path("C:/stuff"))).toThrow(/read-only/);
    });
});
