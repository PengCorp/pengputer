import _ from "lodash";
import type {
  AudioFile,
  BinaryFile,
  ImageFile,
  LinkFile,
  LinkOpenType,
  TextFile,
} from "src/Pengputer/fileTypes";
import { type Executable, FileSystemObjectType } from "./types";

export class FileInfoDirectory {
  type: FileSystemObjectType.Directory = FileSystemObjectType.Directory;

  #name: string;
  #entries: FileInfo[] = [];

  constructor(name: string, entries: FileInfo[]) {
    this.#name = name;
    this.#entries = entries;
  }

  get name() {
    return this.#name;
  }

  get entries(): readonly FileInfo[] {
    return [...this.#entries];
  }

  addItem(info: Exclude<FileInfo, FileInfoDirectory>) {
    if (_.find(this.#entries, (e) => e.name === info.name)) {
      throw new Error(`${info.name} already exists`);
    }

    this.#entries.push(info);
    return info;
  }

  mkdir(name: string): FileInfoDirectory {
    if (_.find(this.#entries, (e) => e.name === name)) {
      throw new Error(`${name} already exists`);
    }

    const dir = new FileInfoDirectory(name, []);
    this.#entries.push(dir);
    return dir;
  }

  rmdir(name: string, force: boolean = false) {
    const entries = this.#entries;
    const dir = _.find(entries, (e) => e.name === name);
    if (!dir) {
      throw new Error(`${name} does not exist`);
    }

    if (dir.type !== FileSystemObjectType.Directory) {
      throw new Error(`${name} is not a directory`);
    }

    if (dir.entries.length !== 0 && !force) {
      throw new Error(`${name} is not empty`);
    }

    _.remove(entries, (e) => e.name === name);
  }
}

export interface FileInfoText {
  type: FileSystemObjectType.TextFile;
  name: string;
  data: TextFile;
}

export interface FileInfoExecutable {
  type: FileSystemObjectType.Executable;
  name: string;
  createInstance: () => Executable;
}

export interface FileInfoAudio {
  type: FileSystemObjectType.Audio;
  name: string;
  data: AudioFile;
}

export interface FileInfoImage {
  type: FileSystemObjectType.Image;
  name: string;
  data: ImageFile;
}

export interface FileInfoLink {
  type: FileSystemObjectType.Link;
  name: string;
  data: LinkFile;
  openType: LinkOpenType;
}

export interface FileInfoBinary {
  type: FileSystemObjectType.Binary;
  name: string;
  data: BinaryFile;
}

export type FileInfo =
  | FileInfoDirectory
  | FileInfoText
  | FileInfoExecutable
  | FileInfoAudio
  | FileInfoImage
  | FileInfoLink
  | FileInfoBinary;
