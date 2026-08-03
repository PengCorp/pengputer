import { describe, expect, test, vi } from "vitest";
import { FileSystem } from "./FileSystem";
import { FilePath } from "./FilePath";
import { FileMode, FileType, type DriveLetter } from "./types";
import { FileSystemDrive } from "./Drive";
import { TextFile } from "./fileTypes";

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

    test("mounts one drive at multiple letters with independent modes", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false, "WORK");
        fs.registerDrive(drive);
        expect(fs.mount("D", drive.label, FileMode.READ)).toBe(true);
        expect(fs.mount("E", drive.label, FileMode.WRX)).toBe(true);

        fs.createFile(path("E:/notes.txt"));
        const readOnlyHandle = fs.openFile(path("D:/notes.txt"))!;
        const writableHandle = fs.openFile(path("E:/notes.txt"))!;
        writableHandle.write!("shared");

        expect(fs.getDriveByLetter("D")).toBe(drive);
        expect(fs.getDriveByLetter("E")).toBe(drive);
        expect(fs.getMountpoints(drive.label)).toStrictEqual(["D", "E"]);
        expect(readOnlyHandle.read!()).toBe("shared");
        expect(readOnlyHandle.write).toBeUndefined();
        expect(writableHandle.write).toBeTypeOf("function");
        expect(
            fs
                .listAllDrives()
                .filter(({ drive: listedDrive }) => listedDrive === drive)
                .map(({ letter }) => letter),
        ).toStrictEqual(["D", "E"]);

        expect(fs.unmount("D")).toBe(true);
        expect(fs.getDriveByLetter("D")).toBeNull();
        expect(fs.getDriveByLetter("E")).toBe(drive);
        expect(fs.getMountpoints(drive.label)).toStrictEqual(["E"]);
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

    test("lists each mounted drive once, followed by unmounted drives sorted by label", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false, "MOUNTED"));
        fs.registerDrive(new FileSystemDrive(false, "ZEBRA"));
        fs.registerDrive(new FileSystemDrive(false, "ALPHA"));

        expect(
            fs.listAllDrives().map(({ letter, drive }) => [letter, drive.label]),
        ).toStrictEqual([
            ["C", "SYSTEM"],
            ["D", "MOUNTED"],
            [null, "ALPHA"],
            [null, "ZEBRA"],
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

    test("throws when a writable drive is mounted without write permission", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false, "LOCKED");
        fs.registerDrive(drive);
        fs.mount("D", drive.label, FileMode.READ | FileMode.EXECUTE);

        expect(() => fs.createDirectory(path("D:/stuff"))).toThrow(/read-only/);
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

describe("FileSystem file modes and handles", () => {
    test("defaults text files to read/write and executable entries to read/write/execute", () => {
        const drive = new FileSystemDrive(false);
        const textInput = {
            type: FileType.TextFile as const,
            name: "notes.txt",
            data: new TextFile(),
        };
        const text = drive.rootEntry.addItem(textInput);
        const executable = drive.rootEntry.addItem({
            type: FileType.Executable,
            name: "program.exe",
            createInstance: () => ({ run: async () => {} }),
        });

        expect(text.mode).toBe(FileMode.READ | FileMode.WRITE);
        expect(executable.mode).toBe(FileMode.WRX);
        expect("mode" in textInput).toBe(false);
    });

    test("createFile honors its requested mode", () => {
        const fs = new FileSystem();
        mountDrive(fs, "D", new FileSystemDrive(false));

        const entry = fs.createFile(path("D:/notes.txt"), FileMode.READ);
        expect(entry.mode).toBe(FileMode.READ);
    });

    test("does not create through a mount without write permission", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false, "LOCKED");
        fs.registerDrive(drive);
        fs.mount("D", drive.label, FileMode.READ);

        expect(() => fs.openFile(path("D:/notes.txt"), true)).toThrow(
            /read-only/,
        );
        expect(fs.getFileInfo(path("D:/notes.txt"))).toBeNull();
    });

    test("exposes text capabilities according to effective permissions", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false, "WORK");
        fs.registerDrive(drive);
        fs.mount("D", drive.label, FileMode.READ);
        drive.rootEntry.addItem({
            type: FileType.TextFile,
            name: "notes.txt",
            data: new TextFile(),
        });

        const handle = fs.openFile(path("D:/notes.txt"))!;
        expect(handle.read).toBeTypeOf("function");
        expect(handle.write).toBeUndefined();
        expect(handle.execute).toBeUndefined();
    });

    test("does not expose an unimplemented execute operation for images", () => {
        const fs = new FileSystem();
        fs.getDriveByLetter("C")!.rootEntry.addItem({
            type: FileType.Image,
            name: "picture.png",
            data: { load: async () => null } as never,
        });

        expect(fs.openFile(path("C:/picture.png"))!.execute).toBeUndefined();
    });

    test("mount noexec removes special-action capabilities", () => {
        const fs = new FileSystem();
        const drive = new FileSystemDrive(false, "NOEXEC");
        fs.registerDrive(drive);
        fs.mount("D", drive.label, FileMode.READ | FileMode.WRITE);
        drive.rootEntry.addItem({
            type: FileType.Link,
            name: "website.lnk",
            data: { open: vi.fn() } as never,
            openType: "open",
        });

        expect(fs.openFile(path("D:/website.lnk"))!.execute).toBeUndefined();
    });
});
