import {
  AudioFile,
  ImageFile,
  LinkFile,
  LinkOpenType,
  TextFile,
} from "./fileTypes";

export const PATH_SEPARATOR = "/";

export enum FileSystemObjectType {
  Directory = "dir",
  TextFile = "txt",
  Executable = "exe",
  Audio = "aud",
  Image = "img",
  Link = "lnk",
}

export interface Executable {
  run: (args: string[]) => Promise<void>;
}

export class FilePath {
  static tryParse(
    path: string,
    defaultDrive: string | null = null,
  ): FilePath | null {
    if (path.length === 0) return new FilePath(null, [], false);
    if (path === "/") return new FilePath(null, [], true);

    let drive: string | null = null;

    const colonIndex = path.indexOf(":");
    if (colonIndex >= 0) {
      drive = path.slice(0, colonIndex).toUpperCase();
      path = path.slice(colonIndex + 1);
      // TODO(local): file info parse error
      if (drive.length !== 1) return null;
      if (path.slice(0, 1) !== "/") return null;

      // TODO(local): file info parse error
      if (drive !== "A" && drive !== "C") return null;
    }

    const isAbsolute = path.length > 1 && path[0] === "/";
    if (isAbsolute) {
      path = path.slice(1);
      if (drive === null) drive = defaultDrive;
    }

    const pieces = path.split("/").filter((s) => s.length > 0);
    return new FilePath(drive, pieces, isAbsolute);
  }

  private _drive: string | null;
  private _pieces: string[];
  private _isAbsolute: boolean;

  private constructor(
    drive: string | null,
    pieces: string[],
    isAbsolute: boolean,
  ) {
    isAbsolute = drive !== null || isAbsolute;

    this._drive = drive;
    this._isAbsolute = isAbsolute;

    this._pieces = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];

      if (piece === "..") {
        if (isAbsolute) {
          if (this._pieces.length !== 0) this._pieces.pop();
        } else this._pieces.push("..");
      } else if (piece === ".") {
        continue;
      } else this._pieces.push(piece);
    }
  }

  get drive() {
    return this._drive;
  }

  get pieces(): readonly string[] {
    return [...this._pieces];
  }

  hasDrive() {
    return this.drive !== null;
  }

  isAbsolute() {
    return this._isAbsolute;
  }

  isRelative() {
    return !this._isAbsolute;
  }

  combine(other: FilePath) {
    if (other.isAbsolute()) return this;
    return new FilePath(
      this._drive,
      [...this._pieces, ...other._pieces],
      this._isAbsolute,
    );
  }

  toString() {
    const pathPart = this._pieces.join(PATH_SEPARATOR);
    if (this.drive !== null) {
      return `${this.drive}:${PATH_SEPARATOR}${pathPart}`;
    } else if (this._isAbsolute) {
      return `${PATH_SEPARATOR}${pathPart}`;
    } else return `.${PATH_SEPARATOR}${pathPart}`;
  }

  parentDirectory() {
    const pieces = this._pieces;
    if (pieces.length === 0) return this;
    return new FilePath(
      this._drive,
      pieces.slice(0, pieces.length - 1),
      this._isAbsolute,
    );
  }
}

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
    this.#entries.push(info);
    return info;
  }

  mkdir(name: string): FileInfoDirectory {
    const dir = new FileInfoDirectory(name, []);
    this.#entries.push(dir);
    return dir;
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

export type FileInfo =
  | FileInfoDirectory
  | FileInfoText
  | FileInfoExecutable
  | FileInfoAudio
  | FileInfoImage
  | FileInfoLink;

interface FileSystemDrive {
  rootEntry: FileInfoDirectory;
}

export class FileSystem {
  private drives: { [id: string]: FileSystemDrive };

  constructor() {
    this.drives = {
      A: { rootEntry: new FileInfoDirectory("/", []) },
      C: { rootEntry: new FileInfoDirectory("/", []) },
    };
  }

  getFileInfo(path: FilePath | null): FileInfo | null {
    if (path === null) return null;

    const { drive, pieces } = path;
    if (drive === null) return null;

    const fsDrive: FileSystemDrive = this.drives[drive];
    if (fsDrive === undefined) return null;

    const rootEntry = fsDrive.rootEntry;
    if (pieces.length === 0) {
      return rootEntry;
    }

    let cur: FileInfoDirectory = rootEntry;
    for (let i = 0; i < pieces.length - 1; i++) {
      const pathName = pieces[i];

      const entries = cur.entries;
      const found =
        entries.find(
          (e) =>
            e.type === FileSystemObjectType.Directory && e.name === pathName,
        ) ?? null;

      if (found && found.type === FileSystemObjectType.Directory) {
        cur = found;
      } else return null;
    }

    const pathName = pieces[pieces.length - 1];

    const entries = cur.entries;
    return entries.find((e) => e.name === pathName) ?? null;
  }
}
