import { FileInfoDirectory } from "../FileInfo";
import type { DriveKind, FileSystemDrive } from "./FileSystemDrive";

export class TransientFileSystemDrive implements FileSystemDrive {
    readonly readOnly: boolean;
    readonly kind: DriveKind = "Fixed";
    readonly label: string;

    #rootEntry: FileInfoDirectory;

    constructor(readOnly: boolean = true, label: string = "UNTITLED") {
        this.readOnly = readOnly;
        this.label = label;
        this.#rootEntry = new FileInfoDirectory("/", []);
    }

    get rootEntry(): FileInfoDirectory {
        return this.#rootEntry;
    }
}
