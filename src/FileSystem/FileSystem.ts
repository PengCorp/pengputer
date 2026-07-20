import type { FilePath } from "./FilePath";
import type { FileEntry, FileEntryDirectory } from "./FileInfo";
import { type DriveLetter, isDriveLetter, FileMode } from "./constants";
import { FileType } from "./types";
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

/* Opened file/directory */
export interface FileHandle {
    readonly mode: FileMode;
    readonly type: FileType;
    readonly path: FilePath;
    read?(): string;
    write?(text: string): void;
    /* Execute program / Special action (play/pause, open link, etc.); async */
    execute?(args: string[]): Promise<boolean>;

    getEntry(): /*readonly*/ FileEntry
}

function summarizeContents(dir: FileEntryDirectory): DriveContentsSummary {
    let directoryCount = 0;
    let fileCount = 0;

    for (const entry of dir.entries) {
        if (entry.type === FileType.Directory) {
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

export interface MountedDrive {
    readonly flags: FileMode,
    readonly label: string
};

export class FileSystem {
    // mounts["C:"] -> MountedDrive { -rx, "SYSTEM" }
    // drives["SYSTEM"] -> <FileSystemDrive "SYSTEM">
    #mounts = new Map<DriveLetter, MountedDrive>();
    #drives = new Map<string, FileSystemDrive>();

    constructor() {
        this.registerDrive(new FileSystemDrive(true, "SYSTEM", "Fixed"));
        this.mount("C", "SYSTEM", FileMode.WRX);
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

    mount(letter: DriveLetter, label: string, flags: FileMode = FileMode.WRX): boolean {
        if(!isDriveLetter(letter)) {
            console.error("mount(\""+label+"\"): not a valid drive letter");
            return false
        }
        if(this.#mounts.has(letter)) {
            if(this.#mounts.get(letter)!.label !== label) {
                console.error("mount(\""+label+"\"): letter already used");
                return false;
            }
        }
        //if(this.getMountpoint(label) != null) return false;
        if(!this.#drives.has(label)) return false;
        const diskMode = this.#drives.get(label)!.readOnly ? ~FileMode.WRITE : FileMode.WRX;
        let mountInfo: MountedDrive = {
            label: label,
            flags: (flags & diskMode) & FileMode.WRX
        }
        this.#mounts.set(letter, mountInfo);
        return true;
    }

    /* mountDrive(letter: DriveLetter, drive: FileSystemDrive): boolean {
        this.registerDrive(drive);
        return this.mount(letter, drive.label);
    } */

    unmount(letter: DriveLetter): boolean {
        if(!this.#mounts.has(letter)) return false;
        this.#mounts.delete(letter);
        return true;
    }

    isMounted(letter: DriveLetter): boolean {
        return this.#mounts.has(letter);
    }

    getDriveByLetter(letter: DriveLetter): FileSystemDrive | null {
        const mount = this.#mounts.get(letter);
        if(!mount) return null;
        const drive = this.#drives.get(mount.label);
        if(!drive) return null;
        return drive;
    }

    getDriveByLabel(letter: string): FileSystemDrive | null {
        const drive = this.#drives.get(letter);
        if(!drive) return null;
        return drive;
    }

    getMountedDriveMode(letter: string): FileMode {
        const info = this.#mounts.get(letter);
        if(!info) return 0;
        return info.flags;
    }

    getMountpoint(label: string): DriveLetter | null {
        for (const [ letter, { label: mountedLabel } ] of this.#mounts.entries()) {
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
            .map((([letter, info]) => {
                const drive = this.getDriveByLabel(info.label)!;
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

    openFile(path: FilePath, create: boolean = false): FileHandle | null {
        const entry = this.getFileInfo(path, create);
        if(!entry) return null;
        const driveMode = this.#mounts.get(path.drive!)!.flags;
        const mode = (entry.mode & driveMode) & FileMode.WRX;

        let writefunc, readfunc, execfunc;
        writefunc = null; readfunc = null; execfunc = null;
        // above funcs must be set as `function() { ... }` instead of
        // `() => ...` because the latter doesn't seem to capture context
        // from .bind()

        if((mode & FileMode.READ) === FileMode.READ) {
            if(entry.type == FileType.TextFile) {
                readfunc = (function(){ return this.data.getText(); })
            }
        }

        if((mode & FileMode.WRITE) === FileMode.WRITE) {
            if(entry.type == FileType.TextFile) {
                writefunc = (function(data: string) {
                    this.data.replace(data);
                })
            }
        }

        if((mode & FileMode.EXECUTE) === FileMode.EXECUTE) {
            if(entry.type != FileType.TextFile && entry.type != FileType.Directory) {
                execfunc = (async function(args: string[]){
                    const arg1 = args[0];
                    if(this.type == FileType.Audio) {
                        if(arg1 === "play")
                            return this.data.play(), true;
                        else if(arg1 === "stop")
                            return this.data.stop(), true;
                        else return false;
                    } else if(this.type == FileType.Executable) {
                        return await this.createInstance().run(args);
                    } else if(this.type == FileType.Image) {
                        throw new Error("TODO");
                    } else if(this.type == FileType.Link) {
                        if(arg1 === this.openType)
                            return true;
                        else if(!arg1)
                            this.data.open();
                        else return false;
                    } else {
                        throw new Error("FileHandle.read not implemented for file type " + this.type);
                    }
                })
            }
        }
        if(writefunc) writefunc = writefunc.bind(entry);
        if(readfunc) readfunc = readfunc.bind(entry);
        if(execfunc) execfunc = execfunc.bind(entry);

        const handle: FileHandle = {
            mode: mode,
            type: entry.type,
            write: writefunc,
            read: readfunc,
            execute: execfunc,
            getEntry: (function() { return this as FileEntry; }).bind(entry)
        };

        return handle;
    }

    // TODO: see in FilePath:tryParse
    // USERS: please use FileSystem.openFile instead
    getFileInfo(path: FilePath | null, create: boolean = false): FileEntry | null {
        if (path === null || path.drive === null) return null;

        const drive = this.getDriveByLetter(path.drive);
        if (!drive) return null;

        let entry: FileEntry = drive.rootEntry;
        for (let i = 0; i < path.pieces.length; i++) {
            const name = path.pieces[i];
            if (entry.type !== FileType.Directory) return null;

            const next: FileEntry | undefined = entry.entries.find(
                (e) => e.name === name,
            );
            if (!next) {
                if (i == path.pieces.length-1 && create) {
                    // optionally create a text file
                    this.#requireWritableDrive(path.drive!);
                    return entry.addItem({
                        type: FileType.TextFile,
                        data: new TextFile,
                        name: name,
                        mode: 6 /* WR- */
                    });
                } else return null;
            }

            entry = next;
        }

        // unsuitable since it destroys local permissions
        /* if(entry != null) {
            entry.mode &= driveMode;
        } */

        return entry;
    }

    createDirectory(path: FilePath): void {
        let dir = this.#requireWritableDrive(path.drive).rootEntry;
        for (const name of path.pieces) {
            const existing = dir.entries.find((e) => e.name === name);
            if (existing === undefined) {
                dir = dir.mkdir(name);
            } else if (existing.type === FileType.Directory) {
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
        if (parent.type !== FileType.Directory) {
            throw new Error(`${parentPath.toString()} is not a directory`);
        }

        parent.rmdir(segments[segments.length - 1], force);
    }

    /* Create new text file */
    createFile(path: FilePath): FileEntry {
        let dir = this.#requireWritableDrive(path.drive).rootEntry;
        for (const i in path.pieces) {
            const name = path.pieces[i];
            let existing = dir.entries.find((e) => e.name === name);
            if (i == path.pieces.length-1) {
                if(!existing) {
                    return dir.addItem({
                        type: FileType.TextFile,
                        data: new TextFile,
                        name
                    });
                }
                if(existing.type == FileType.Directory) {
                    throw new Error("Cannot create " + path.toString() + ": Is a Directory");
                }
                return existing;
            }
            if (existing === undefined) {
                dir = dir.mkdir(name);
            } else if (existing.type === FileType.Directory) {
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
