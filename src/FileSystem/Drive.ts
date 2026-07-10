import { FileInfoDirectory } from "./FileInfo";

export type DriveKind = "Fixed" | "Floppy" | "RAMFloppy";

export class FileSystemDrive {
    readonly readOnly: boolean;
    readonly kind: DriveKind;
    readonly label: string;

    #root: FileInfoDirectory;

    constructor(readOnly: boolean = true, label: string = "UNTITLED", kind: DriveKind = "RAMFloppy") {
        this.readOnly = readOnly;
        this.label = label;
        this.kind = kind;
        this.#root = new FileInfoDirectory("/", []);
    }

    get rootEntry(): FileInfoDirectory {
        return this.#root;
    }
}
