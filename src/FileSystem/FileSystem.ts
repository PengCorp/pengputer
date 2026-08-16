import type { FilePath } from "./FilePath";
import { type DriveLetter, isDriveLetter, FileMode } from "./constants";
import { FileType } from "./types";
import { FileSystemDrive } from "./Drive";
import { AudioFile, ImageFile, LinkFile, TextFile } from "./fileTypes";
import type {
    FileEntry, FileEntryDirectory,
    FileEntryAudio, FileEntryImage,
    FileEntryLink, FileEntryText
} from "./FileInfo";
import { gzip, gunzip } from "@Toolbox/Compression";
import _ from "lodash";

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
    read?: (() => string) | undefined;
    write?: ((text: string) => void) | undefined;
    /* Execute program / Special action (play/pause, open link, etc.); async */
    execute?: ((args: string[]) => Promise<void>) | undefined;

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

function deepJSONifyDir(dir: FileEntryDirectory): object {
    var obj: any = {};

    Object.assign(obj, dir);
    obj.name = dir.name;
    obj.entries = [];
    for (let subent of dir.entries) {
        let entry: any = {};
        if(subent.type === FileType.Directory) {
            Object.assign(entry, deepJSONifyDir(subent));
            obj.entries.push(entry);
            continue;
        }
        Object.assign(entry, subent);
        switch(subent.type) {
            case FileType.TextFile:
                entry.data = subent.data.getText();
                break;
            case FileType.Executable:
                continue; /* TODO: should we even try to support exporting executables */
            case FileType.Link:
            case FileType.Audio:
            case FileType.Image:
                entry.url = subent.data.getURL();
                break;
            default:
                let updateFSexportAndImportImpl = (c: never) => c;
                // this will error at comptime if switch is not exhaustive
                updateFSexportAndImportImpl(subent);
                break;
        }
        obj.entries.push(entry)
    }

    return obj;
}

export class FileSystem {
    // mounts["C:"] -> MountedDrive { -rx, "SYSTEM" }
    // drives["SYSTEM"] -> <FileSystemDrive "SYSTEM">
    #mounts = new Map<DriveLetter, MountedDrive>();
    #drives = new Map<string, FileSystemDrive>();

    async exportFS(drivelabel: string): Promise<string|null> {
        const drive = this.#drives.get(drivelabel);
        if(!drive) return null;

        const fstree = deepJSONifyDir(drive.rootEntry);
        const stringfs = JSON.stringify(fstree);
        const gzipBytes = new Uint8Array(await gzip(stringfs));
        const encodedfs = btoa(Array.from(gzipBytes, b => String.fromCodePoint(b)).join(""));
        var result = "PENGRFS!"+String(drivelabel.length)+"!"+drivelabel+encodedfs;
        return result;
    }

    /** @returns Label of imported drive */
    async importFS(encoded: string): Promise<string> {
        /* Controls if a tree of files is printed
         * in the console as they are imported */
        const import_log = false;

        if(encoded.slice(0, 8) != "PENGRFS!") {
            throw new Error("Uploaded file is not a Penger filesystem [0]");
        }
        encoded = encoded.slice(8);

        var labelLen = 0;
        while(48 <= encoded.charCodeAt(0) && encoded.charCodeAt(0) <= 57) {
            labelLen *= 10;
            labelLen += encoded.charCodeAt(0) - 48;
            encoded = encoded.slice(1);
        }
        if(encoded.length < labelLen+1+8
        || encoded[0] != '!') {
            throw new Error("Uploaded file is not a Penger filesystem [1]");
        }
        if(labelLen == 0) {
            throw new Error("Malformed Penger Filesystem: bad label");
        }
        encoded = encoded.slice(1);

        const label = encoded.slice(0, labelLen).toUpperCase();
        if(label.length != labelLen) {
            throw new Error("Uploaded file is not a Penger filesystem [2]");
        }
        encoded = encoded.slice(labelLen);

        if(this.#drives.has(label)) {
            throw new Error("Disk " +label+ " already exists on this PengPuter.");
        }

        let fstree_bytes: ArrayBuffer;

        // the rest is base64-encoded gzip'ed FS JSON object
        try {
            const bytes = Uint8Array.from(atob(encoded), c=>c.charCodeAt(0));
            fstree_bytes = await gunzip(bytes);
        } catch(err) {
            let e = <Error>err;
            if(e.message) e.message = "Decode error: " + e.message;
            throw e;
        }
        const fstree_str = new TextDecoder().decode(fstree_bytes);
        const fstree = JSON.parse(fstree_str);

        const obligKeys = ["name", "type", "mode"];
        const validKeys = [...obligKeys, "entries", "openType", "data", "url"];

        const checkEntry = function(obj: any) {
            if(!obj || typeof obj !== "object") return false;
            const keys = Object.keys(obj);
            if(keys.some(k => !validKeys.includes(k))) return false;
            if(obligKeys.some(k => !keys.includes(k))) return false;
            if(typeof obj.name !== "string"
            || typeof obj.type !== "string"
            || typeof obj.mode !== "number") return false;
            if((obj.mode & ~FileMode.WRX) != 0) return false;
            return true;
        }

        if(fstree.name !== '/'
        || fstree.type !== FileType.Directory
        || (fstree.mode & ~FileMode.WRX) != 0) {
            throw new Error("Malformed Penger Filesystem: bad root entry");
        }

        const drive = new FileSystemDrive(!(fstree.mode & FileMode.WRITE), label, "Floppy");

        const importDir = function(dir: FileEntryDirectory, src: any) {
            if(!checkEntry(src)) {
                throw new Error("Bad FS: Invalid directory entry");
            }

            if(src.type != FileType.Directory) {
                throw new Error("Tried to import directory from non-directory ("+String(src.type)+")");
            }
            dir.mode = src.mode;

            import_log && console.group("Importing directory", src.name);
            for(const subent of src.entries) {
                const coolName = ".../" + src.name + "/" + subent.name;
                var entry: Partial<FileEntry> = {};
                if(!checkEntry(subent)) {
                    throw new Error("Bad FS: Invalid entry in " + coolName);
                }
                if(subent.type === FileType.Directory) {
                    entry = dir.mkdir(subent.name);
                    importDir(entry as FileEntryDirectory, subent);
                    continue;
                } else {
                    entry.type = subent.type;
                    entry.mode = subent.mode;
                    if("url" in subent && typeof subent.url === "string") {
                        // only allow http and file protocols
                        try {
                            const parsed = new URL(subent.url);
                            if(!/(https?|file)/.match(parsed.protocol)) {
                                throw "ERROR_REPORT_BUG";
                            }
                        } catch(e) {
                            throw new Error("Bad FS: Bad entry URL");
                        }
                    }
                    switch(subent.type) {
                        case FileType.TextFile:
                            if(!("data" in subent) || typeof subent.data != "string") {
                                throw new Error("Bad FS: Bad file entry (missing data) in " + coolName);
                            }
                            (<FileEntryText>entry).data = new TextFile();
                            (<FileEntryText>entry).data.replace(subent.data);
                            break;
                        case FileType.Executable:
                            console.error(subent.name+": Cannot import executables");
                            continue;
                        case FileType.Link:
                            if(!("url" in subent) || typeof subent.url != "string"
                            || !("openType" in subent) || typeof subent.openType != "string") {
                                throw new Error("Bad FS: Bad file entry (missing data) in " + coolName);
                            }
                            (<FileEntryLink>entry).data = new LinkFile(subent.url);
                            (<FileEntryLink>entry).openType = subent.openType;
                            break;
                        case FileType.Audio:
                            if(!("url" in subent) || typeof subent.url != "string") {
                                throw new Error("Bad FS: Bad file entry (missing data) in " + coolName);
                            }
                            (<FileEntryAudio>entry).data = new AudioFile(subent.url);
                            break;
                        case FileType.Image:
                            if(!("url" in subent) || typeof subent.url != "string") {
                                throw new Error("Bad FS: Bad file entry (missing data) in " + coolName);
                            }
                            (<FileEntryImage>entry).data = new ImageFile(subent.url);
                            break;
                        default:
                            throw new Error(`Bad FS: Bad file type ("${subent.type}") at ${coolName}`);
                    }
                    import_log && console.log("Importing file", subent.name, "("+entry.type+")");
                }
                dir.addItem({
                    ...entry,
                    name: subent.name
                } as Exclude<FileEntryDirectory, FileEntry>);
            }
            import_log && console.groupEnd();
        }

        importDir(drive.rootEntry, fstree);

        this.registerDrive(drive);

        return label;
    }

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
        if(this.getMountpoints(label).length) {
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

    getMountedDriveMode(letter: DriveLetter): FileMode {
        const info = this.#mounts.get(letter);
        if(!info) return 0;
        return info.flags;
    }

    getMountpoints(label: string): DriveLetter[] {
        let list: DriveLetter[] = [];
        for (const [ letter, { label: mountedLabel } ] of this.#mounts.entries()) {
            if(mountedLabel === label) list.push(letter);
        }
        return list;
    }

    listAllDrives(): DriveMount[] {
        return [
            ...this.listMountedDrives(),
            ...(([...this.#drives.entries()] as [string, FileSystemDrive][])
                .filter(([label]) => !this.getMountpoints(label).length)
                .map(([label, drive]) => {
                    return { letter: null, drive };
                })
                .sort((a, b) => a.drive.label.localeCompare(b.drive.label)))
        ];
    }

    listMountedDrives(): DriveMount[] {
        return [...this.#mounts.entries()]
            .map(([letter, info]: [DriveLetter, MountedDrive]) => {
                const drive = this.getDriveByLabel(info.label)!;
                return { letter, drive };
            })
            .sort((a, b) => a.letter.localeCompare(b.letter));
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
        // above funcs must be set as `function() { ... }` instead of
        // `() => ...` because the latter doesn't seem to capture context
        // from .bind()

        if((mode & FileMode.READ) === FileMode.READ) {
            if(entry.type == FileType.TextFile) {
                readfunc = (function(this: FileEntry){ return (<FileEntryText>this).data.getText(); })
            }
        }

        if((mode & FileMode.WRITE) === FileMode.WRITE) {
            if(entry.type == FileType.TextFile) {
                writefunc = (function(this: FileEntry, data: string) {
                    (<FileEntryText>this).data.replace(data);
                })
            }
        }

        if((mode & FileMode.EXECUTE) === FileMode.EXECUTE) {
            if(
                entry.type === FileType.Audio ||
                entry.type === FileType.Executable ||
                entry.type === FileType.Link
            ) {
                execfunc = (async function(this: FileEntry, args: string[]){
                    const arg1 = args[0];
                    if(this.type == FileType.Audio) {
                        if(arg1 === "play")
                            this.data.play();
                        else if(arg1 === "stop")
                            this.data.stop();
                    } else if(this.type == FileType.Executable) {
                        await this.createInstance().run(args);
                    } else if(this.type == FileType.Link) {
                        this.data.open();
                    } else {
                        throw new Error(
                            "FileHandle.execute not implemented for file type " +
                                this.type,
                        );
                    }
                })
            }
        }
        if(readfunc) readfunc = readfunc.bind(entry);
        if(writefunc) writefunc = writefunc.bind(entry);
        if(execfunc) execfunc = execfunc.bind(entry);

        const handle: FileHandle = {
            mode: mode,
            type: entry.type,
            path: path,
            read: readfunc,
            write: writefunc,
            execute: execfunc,
            getEntry: (function(this: FileEntry) { return this; }).bind(entry)
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
                    this.#requireWritableMount(path.drive!);
                    return entry.addItem({
                        type: FileType.TextFile,
                        data: new TextFile(),
                        name: name,
                        mode: FileMode.READ | FileMode.WRITE,
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
        let dir = this.#requireWritableMount(path.drive).rootEntry;
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
        this.#requireWritableMount(path.drive);

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
    createFile(
        path: FilePath,
        mode: FileMode = FileMode.READ | FileMode.WRITE,
    ): FileEntry {
        let dir = this.#requireWritableMount(path.drive).rootEntry;
        for (let i = 0; i < path.pieces.length; i++) {
            const name = path.pieces[i];
            let existing = dir.entries.find((e) => e.name === name);
            if (i == path.pieces.length-1) {
                if(!existing) {
                    return dir.addItem({
                        type: FileType.TextFile,
                        data: new TextFile(),
                        name,
                        mode,
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

    #requireWritableMount(letter: DriveLetter | null): FileSystemDrive {
        if (letter === null) throw new Error("Path has no drive");

        const drive = this.getDriveByLetter(letter);
        if (!drive) throw new Error(`Drive ${letter}: is not mounted`);
        const ro = drive.readOnly || !(this.getMountedDriveMode(letter) & FileMode.WRITE);
        if (ro) throw new Error(`Drive ${letter}: is read-only`);

        return drive;
    }
}
