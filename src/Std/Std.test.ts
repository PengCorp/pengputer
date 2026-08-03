import { describe, expect, test } from "vitest";
import type { Keyboard } from "../Keyboard";
import type { Screen } from "../Screen";
import type { TextBuffer } from "../TextBuffer";
import { FilePath, FileSystem, FileSystemDrive } from "../FileSystem";
import { Std } from "./Std";

function createStd(fileSystem: FileSystem): Std {
    return new Std({} as Keyboard, {} as TextBuffer, {} as Screen, fileSystem);
}

describe("Std filesystem paths", () => {
    test("resolves a root-relative path against the current drive", () => {
        const std = createStd(new FileSystem());

        expect(std.getAbsolutePathS("/pengos")!.toString()).toBe("C:/pengos");
    });

    test("changes to a root-relative directory on the current drive", () => {
        const fileSystem = new FileSystem();
        const drive = new FileSystemDrive(false, "WORK");
        fileSystem.registerDrive(drive);
        fileSystem.mount("D", drive.label);
        fileSystem.createDirectory(FilePath.tryParse("D:/projects")!);
        const std = createStd(fileSystem);
        std.setCwd("D:/projects");

        expect(std.setCwd("/").toString()).toBe("D:/");
    });

    test("leaves cwd unchanged when the target is not a directory", () => {
        const fileSystem = new FileSystem();
        const std = createStd(fileSystem);

        expect(std.setCwd("C:/missing").toString()).toBe("C:/");
        expect(std.getCwdStr()).toBe("C:/");
    });
});
