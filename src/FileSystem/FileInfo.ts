import _ from "lodash";
import type {
    AudioFile,
    ImageFile,
    LinkFile,
    LinkOpenType,
    TextFile,
    Executable,
} from "./fileTypes";
import { FileType } from "./types";
import { FileMode } from "./constants";

export class FileEntryDirectory {
    type: FileType.Directory = FileType.Directory;
    mode: FileMode;

    #name: string;
    #entries: FileEntry[] = [];

    constructor(name: string, entries: FileEntry[]) {
        this.#name = name;
        this.#entries = entries;
        this.mode = FileMode.WRX;
    }

    get name() {
        return this.#name;
    }

    get entries(): readonly FileEntry[] {
        return [...this.#entries];
    }

    addItem(info: Exclude<FileEntry, FileEntryDirectory>): FileEntry {
        if (_.find(this.#entries, (e) => e.name === info.name)) {
            throw new Error(`${info.name} already exists`);
        }

        if(info.mode == undefined || info.mode == null) {
            info.mode = FileMode.READ | FileMode.WRITE;
            if(info.type != FileType.TextFile)
                info.mode |= FileMode.EXECUTE;
        }

        this.#entries.push(info);
        return info;
    }

    mkdir(name: string): FileEntryDirectory {
        if (_.find(this.#entries, (e) => e.name === name)) {
            throw new Error(`${name} already exists`);
        }

        const dir = new FileEntryDirectory(name, []);
        dir.mode = FileMode.WRX;
        this.#entries.push(dir);
        return dir;
    }

    rmdir(name: string, force: boolean = false) {
        const entries = this.#entries;
        const dir = _.find(entries, (e) => e.name === name);
        if (!dir) {
            throw new Error(`${name} does not exist`);
        }

        if (dir.type !== FileType.Directory) {
            throw new Error(`${name} is not a directory`);
        }

        if (dir.entries.length !== 0 && !force) {
            throw new Error(`${name} is not empty`);
        }

        _.remove(entries, (e) => e.name === name);
    }
}

export interface FileEntryText {
    type: FileType.TextFile;
    name: string;
    mode: FileMode;
    data: TextFile;
}

export interface FileEntryExecutable {
    type: FileType.Executable;
    name: string;
    mode: FileMode;
    createInstance: () => Executable;
}

export interface FileEntryAudio {
    type: FileType.Audio;
    name: string;
    mode: FileMode;
    data: AudioFile;
}

export interface FileEntryImage {
    type: FileType.Image;
    name: string;
    mode: FileMode;
    data: ImageFile;
}

export interface FileEntryLink {
    type: FileType.Link;
    name: string;
    mode: FileMode;
    data: LinkFile;
    openType: LinkOpenType;
}

export type FileEntry =
    | FileEntryDirectory
    | FileEntryText
    | FileEntryExecutable
    | FileEntryAudio
    | FileEntryImage
    | FileEntryLink;
