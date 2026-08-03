import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    FileMode,
    FilePath,
    FileSystem,
    FileSystemDrive,
    FileType,
    type DriveLetter,
} from "../FileSystem";
import type { Std } from "../Std";
import type { PC } from "./PC";
import { PengerShell } from "./PengerShell";

interface TestableShell {
    readonly workingDirectory: FilePath;
    commandDisk(args: string[]): void;
    commandOpen(args: string[]): Promise<void>;
    commandRun(args: string[]): Promise<void>;
    commandSwitchDrive(letter: DriveLetter): void;
    syncWorkingDirectoryFromStd(): void;
}

function createShell() {
    const fileSystem = new FileSystem();
    let cwd = FilePath.tryParse("C:/")!;
    const std = {
        clearConsole: vi.fn(),
        drawConsoleImage: vi.fn(),
        getConsoleCharacterSize: vi.fn(() => ({ w: 8, h: 16 })),
        getCwd: vi.fn(() => cwd),
        moveConsoleCursorBy: vi.fn(),
        readConsoleKey: vi.fn(async () => undefined),
        readConsoleLine: vi.fn(async () => ""),
        resetConsole: vi.fn(),
        setCwdP: vi.fn((path: FilePath) => {
            const entry = fileSystem.getFileInfo(path);
            if (entry?.type === FileType.Directory) cwd = path;
            return cwd;
        }),
        writeConsole: vi.fn(),
    } as unknown as Std;
    const pc = {
        fileSystem,
        keyboard: {},
        reboot: vi.fn(async () => undefined),
        std,
    } as unknown as PC;
    const shell = new PengerShell(pc) as unknown as TestableShell;

    return { fileSystem, shell, std };
}

beforeEach(() => {
    vi.stubGlobal("window", { location: { search: "" } });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("PengerShell filesystem commands", () => {
    test("opens audio, images, and open-links through their supported operations", async () => {
        const { fileSystem, shell } = createShell();
        const root = fileSystem.getDriveByLetter("C")!.rootEntry;
        const play = vi.fn();
        const stop = vi.fn();
        const load = vi.fn(async () => ({ height: 16 }));
        const open = vi.fn();
        root.addItem({
            type: FileType.Audio,
            name: "song.mid",
            data: { play, stop } as never,
        });
        root.addItem({
            type: FileType.Image,
            name: "picture.png",
            data: { load } as never,
        });
        root.addItem({
            type: FileType.Link,
            name: "website.lnk",
            data: { open } as never,
            openType: "open",
        });

        await shell.commandOpen(["C:/song.mid"]);
        await shell.commandOpen(["C:/picture.png"]);
        await shell.commandOpen(["C:/website.lnk"]);

        expect(play).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
        expect(load).toHaveBeenCalledOnce();
        expect(open).toHaveBeenCalledOnce();
    });

    test("does not run special actions through a noexec mount", async () => {
        const { fileSystem, shell } = createShell();
        const drive = new FileSystemDrive(false, "NOEXEC");
        const play = vi.fn();
        const open = vi.fn();
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label, FileMode.READ | FileMode.WRITE);
        drive.rootEntry.addItem({
            type: FileType.Audio,
            name: "song.mid",
            data: { play, stop: vi.fn() } as never,
        });
        drive.rootEntry.addItem({
            type: FileType.Link,
            name: "website.lnk",
            data: { open } as never,
            openType: "open",
        });

        await shell.commandOpen(["D:/song.mid"]);
        await shell.commandOpen(["D:/website.lnk"]);

        expect(play).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
    });

    test("runs a run-link exactly once", async () => {
        const { fileSystem, shell } = createShell();
        const open = vi.fn();
        fileSystem.getDriveByLetter("C")!.rootEntry.addItem({
            type: FileType.Link,
            name: "game.lnk",
            data: { open } as never,
            openType: "run",
        });

        await shell.commandRun(["C:/game.lnk"]);

        expect(open).toHaveBeenCalledOnce();
    });

    test("switches a newly mounted drive to its root", () => {
        const { fileSystem, shell, std } = createShell();
        const drive = new FileSystemDrive(false, "WORK");
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label);

        shell.commandSwitchDrive("D");

        expect(vi.mocked(std.setCwdP).mock.lastCall![0].toString()).toBe("D:/");
        expect(shell.workingDirectory.toString()).toBe("D:/");
    });

    test("adopts cwd changes made through the global Std API", () => {
        const { fileSystem, shell, std } = createShell();
        const drive = new FileSystemDrive(false, "WORK");
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label);
        fileSystem.createDirectory(FilePath.tryParse("D:/projects")!);
        std.setCwdP(FilePath.tryParse("D:/projects")!);

        shell.syncWorkingDirectoryFromStd();

        expect(shell.workingDirectory.toString()).toBe("D:/projects");
    });

    test("falls back to the drive root when its remembered directory vanished", () => {
        const { fileSystem, shell, std } = createShell();
        const drive = new FileSystemDrive(false, "WORK");
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label);
        fileSystem.createDirectory(FilePath.tryParse("D:/projects")!);
        std.setCwdP(FilePath.tryParse("D:/projects")!);
        shell.syncWorkingDirectoryFromStd();
        shell.commandSwitchDrive("C");
        fileSystem.removeDirectory(FilePath.tryParse("D:/projects")!);

        shell.commandSwitchDrive("D");

        expect(shell.workingDirectory.toString()).toBe("D:/");
    });

    test("rejects malformed drive letters", () => {
        const { fileSystem, shell, std } = createShell();
        fileSystem.registerDrive(new FileSystemDrive(false, "WORK"));

        shell.commandDisk(["insert", "D:anything", "WORK"]);

        expect(fileSystem.isMounted("D")).toBe(false);
        expect(std.writeConsole).toHaveBeenCalledWith(
            "Invalid disk letter: 'D:anything'\n",
        );
    });

    test("reports an already-mounted disk instead of claiming insertion succeeded", () => {
        const { fileSystem, shell, std } = createShell();
        const drive = new FileSystemDrive(false, "WORK");
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label);
        vi.spyOn(console, "error").mockImplementation(() => {});

        shell.commandDisk(["insert", "E", "WORK"]);

        expect(fileSystem.isMounted("E")).toBe(false);
        expect(std.writeConsole).toHaveBeenCalledWith(
            "Disk <WORK> is already inserted at D:\n",
        );
    });
});
