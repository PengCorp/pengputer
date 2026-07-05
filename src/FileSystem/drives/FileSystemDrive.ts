import type { FileInfoDirectory } from "../FileInfo";

export type DriveKind = "Fixed" | "Floppy";

export interface FileSystemDrive {
    readonly readOnly: boolean;
    readonly kind: DriveKind;
    readonly label: string;
    get rootEntry(): FileInfoDirectory;
}
