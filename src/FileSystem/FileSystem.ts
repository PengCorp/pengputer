import type { FilePath } from "./FilePath";
import type { FileInfo, FileInfoDirectory } from "./FileInfo";
import { type DriveLetter, isDriveLetter } from "./constants";
import { FileSystemObjectType } from "./types";
import { FileSystemDrive } from "./Drive";
import { TextFile } from "./fileTypes";

export interface DriveMount {
    letter: DriveLetter | null;
    drive: FileSystemDrive;
}

export interface DriveContentsSummary {
    directoryCount: number;
    fileCount: number;
}

function summarizeContents(dir: FileInfoDirectory): DriveContentsSummary {
    let directoryCount = 0;
    let fileCount = 0;

    for (const entry of dir.entries) {
        if (entry.type === FileSystemObjectType.Directory) {
            directoryCount += 1;

            const nested = summarizeContents(entry);
            directoryCount += nested.directoryCount;
            fileCount += nested.fileCount;
        } else {
            fileCount += 1;
        }
    }

    return { directoryCount, fileCount };
}

export class FileSystem {
    // mounts["C:"] -> "SYSTEM"
    // drives["SYSTEM"] -> <FileSystemDrive "SYSTEM">
    #mounts = new Map<DriveLetter, string>();
    #drives = new Map<string, FileSystemDrive>();

    constructor() {
        this.mountDrive("C", new FileSystemDrive(true, "SYSTEM", "Fixed"));
    }

    registerDrive(drive: FileSystemDrive): boolean {
        let oldDrive = this.#drives.get(drive.label);
        if(!oldDrive) {
            this.#drives.set(drive.label, drive);
            return true;
        }
        // check if already registered
        if(oldDrive.kind === drive.kind
           && oldDrive.readOnly === drive.readOnly) {
            return true;
        }
        // same label different configs
        throw new Error("ERROR: DRIVE LABEL COLLISION: " + drive.label);
    }

    unregisterDrive(label: string) {
        const disk = this.getDriveByLabel(label);
        if(!disk) {
            console.warn("Tried to delete not existing disk <" +label+ ">");
            return;
        }
        if(disk.kind == "Fixed") {
            throw new Error("Tried to unregister fixed drive <" +label+ ">");
        }
        if(this.getMountpoint(label) != null) {
            throw new Error("Tried to unregister mounted drive <" +label+ ">");
        }

        this.#drives.delete(label);
    }

    driveExists(label: string): boolean {
        return this.#drives.has(label);
    }

    mount(letter: DriveLetter, label: string): boolean {
        if(!isDriveLetter(letter)) {
            console.error("mount(\""+label+"\"): not a valid drive letter");
            return false
        }
        if(this.#mounts.has(letter)) {
            if(this.#mounts.get(letter) !== label) {
                console.error("mount(\""+label+"\"): already mounted");
                return false;
            }
        }
        if(!this.#drives.has(label)) return false;
        this.#mounts.set(letter, label);
        return true;
    }

    mountDrive(letter: DriveLetter, drive: FileSystemDrive): boolean {
        this.registerDrive(drive);
        return this.mount(letter, drive.label);
    }

    unmount(letter: DriveLetter): boolean {
        if(!this.#mounts.has(letter)) return false;
        this.#mounts.delete(letter);
        return true;
    }

    isMounted(letter: DriveLetter): boolean {
        return this.#mounts.has(letter);
    }

    getDriveByLetter(letter: DriveLetter): FileSystemDrive | null {
        const label = this.#mounts.get(letter);
        if(!label) return null;
        const drive = this.#drives.get(label);
        if(!drive) return null;
        return drive;
    }

    getDriveByLabel(letter: string): FileSystemDrive | null {
        const drive = this.#drives.get(letter);
        if(!drive) return null;
        return drive;
    }

    getMountpoint(label: string): DriveLetter | null {
        for (const [ letter, mountedLabel ] of this.#mounts.entries()) {
            // console.log({ letter, mountedLabel, label });
            if(mountedLabel === label) return letter;
        }
        return null;
    }

    listAllDrives(): DriveMount[] {
        return [...this.#drives.entries()]
            .map((([label, drive]) => {
                return { letter: this.getMountpoint(label), drive };
            }).bind(this))
            .sort((a, b) =>
                (!a.letter || !b.letter) ? 1 : a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0,
            );
    }

    listMountedDrives(): DriveMount[] {
        return [...this.#mounts.entries()]
            .map((([letter, name]) => {
                const drive = this.getDriveByLabel(name)!;
                return { letter, drive };
            }).bind(this))
            .sort((a, b) =>
                a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0,
            );
    }

    summarizeDrive(drive: FileSystemDrive): DriveContentsSummary {
        return summarizeContents(drive.rootEntry);
    }

    summarizeDriveByLetter(l: DriveLetter): DriveContentsSummary | null {
        const drive = this.getDriveByLetter(l);
        if (!drive) return null;

        return this.summarizeDrive(drive);
    }

    // TODO: see in FilePath:tryParse
    getFileInfo(path: FilePath | null, create: boolean = false): FileInfo | null {
        if (path === null || path.drive === null) return null;

        const drive = this.getDriveByLetter(path.drive);
        if (!drive) return null;

        let entry: FileInfo = drive.rootEntry;
        for (let i = 0; i < path.pieces.length; i++) {
            const name = path.pieces[i];
            if (entry.type !== FileSystemObjectType.Directory) return null;

            const next: FileInfo | undefined = entry.entries.find(
                (e) => e.name === name,
            );
            if (!next) {
                if (i == path.pieces.length-1 && create) {
                    // optionally create a text file
                    this.#requireWritableDrive(path.drive!);
                    next = entry.addItem({
                        type: FileSystemObjectType.TextFile,
                        data: new TextFile,
                        name: name,
                    });
                } else return null;
            }

            entry = next;
        }

        return entry;
    }

    createDirectory(path: FilePath): void {
        let dir = this.#requireWritableDrive(path.drive).rootEntry;
        for (const name of path.pieces) {
            const existing = dir.entries.find((e) => e.name === name);
            if (existing === undefined) {
                dir = dir.mkdir(name);
            } else if (existing.type === FileSystemObjectType.Directory) {
                dir = existing;
            } else {
                throw new Error(`${name} is not a directory`);
            }
        }
    }

    removeDirectory(path: FilePath, force: boolean = false): void {
        this.#requireWritableDrive(path.drive);

        const segments = path.pieces;
        if (segments.length === 0) return; // a drive's root can't be removed

        const parentPath = path.parentDirectory();
        const parent = this.getFileInfo(parentPath);
        if (parent === null) {
            throw new Error(`${parentPath.toString()} does not exist`);
        }
        if (parent.type !== FileSystemObjectType.Directory) {
            throw new Error(`${parentPath.toString()} is not a directory`);
        }

        parent.rmdir(segments[segments.length - 1], force);
    }

    createFile(path: FilePath): FileInfo {
        let dir = this.#requireWritableDrive(path.drive).rootEntry;
        for (const i in path.pieces) {
            console.log({i}, {i: 0});
            const name = path.pieces[i];
            let existing = dir.entries.find((e) => e.name === name);
            if (i == path.pieces.length-1) {
                if(!existing) {
                    return dir.addItem({
                        type: FileSystemObjectType.TextFile,
                        data: new TextFile,
                        name
                    });
                }
                if(existing.type == FileSystemObjectType.Directory) {
                    throw new Error("Cannot create " + path.toString() + ": Is a Directory");
                }
                return existing;
            }
            if (existing === undefined) {
                dir = dir.mkdir(name);
            } else if (existing.type === FileSystemObjectType.Directory) {
                dir = existing;
            } else {
                throw new Error(`${name} is not a directory`);
            }
        }
        throw new Error("unreachable");
    }

    #requireWritableDrive(letter: DriveLetter | null): FileSystemDrive {
        if (letter === null) throw new Error("Path has no drive");

        const drive = this.getDriveByLetter(letter);
        if (!drive) throw new Error(`Drive ${letter}: is not mounted`);
        if (drive.readOnly) throw new Error(`Drive ${letter}: is read-only`);

        return drive;
    }
}
