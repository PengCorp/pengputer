import type { DriveLabel } from "./constants";
import type { FilePath } from "./FilePath";
import type { FileInfo, FileInfoDirectory } from "./FileInfo";
import { FileSystemObjectType } from "./types";
import { TransientFileSystemDrive, type FileSystemDrive } from "./drives";

export interface DriveMount {
    label: DriveLabel;
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
    #drives = new Map<DriveLabel, FileSystemDrive>();

    constructor() {
        this.mount("C", new TransientFileSystemDrive(true, "SYSTEM"));
    }

    mount(label: DriveLabel, drive: FileSystemDrive): boolean {
        if (this.#drives.has(label)) return false;
        this.#drives.set(label, drive);
        return true;
    }

    unmount(label: DriveLabel): void {
        this.#drives.delete(label);
    }

    isMounted(label: DriveLabel): boolean {
        return this.#drives.has(label);
    }

    getDrive(label: DriveLabel): FileSystemDrive | undefined {
        return this.#drives.get(label);
    }

    listDrives(): DriveMount[] {
        return [...this.#drives.entries()]
            .map(([label, drive]) => ({ label, drive }))
            .sort((a, b) =>
                a.label < b.label ? -1 : a.label > b.label ? 1 : 0,
            );
    }

    summarizeDrive(label: DriveLabel): DriveContentsSummary | null {
        const drive = this.#drives.get(label);
        if (!drive) return null;

        return summarizeContents(drive.rootEntry);
    }

    getFileInfo(path: FilePath | null): FileInfo | null {
        if (path === null || path.drive === null) return null;

        const drive = this.#drives.get(path.drive);
        if (!drive) return null;

        let entry: FileInfo = drive.rootEntry;
        for (const name of path.pieces) {
            if (entry.type !== FileSystemObjectType.Directory) return null;

            const next: FileInfo | undefined = entry.entries.find(
                (e) => e.name === name,
            );
            if (!next) return null;

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

    #requireWritableDrive(label: DriveLabel | null): FileSystemDrive {
        if (label === null) throw new Error("Path has no drive");

        const drive = this.#drives.get(label);
        if (!drive) throw new Error(`Drive ${label}: is not mounted`);
        if (drive.readOnly) throw new Error(`Drive ${label}: is read-only`);

        return drive;
    }
}
