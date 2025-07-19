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

export class FileInfo {
  private _drive: string | null;
  private _pieces: string[];
  private _isAbsolute: boolean;

  constructor(drive: string | null, pieces: string[], isAbsolute: boolean) {
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
  get pieces() {
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

  combine(other: FileInfo) {
    if (other.isAbsolute()) return this;
    return new FileInfo(
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
    return new FileInfo(
      this._drive,
      pieces.slice(0, pieces.length - 1),
      this._isAbsolute,
    );
  }
}

export function parseFileInfo(
  path: string,
  defaultDrive: string | null,
): FileInfo | null {
  if (path.length === 0) return new FileInfo(null, [], false);
  if (path === "/") return new FileInfo(null, [], true);

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
  return new FileInfo(drive, pieces, isAbsolute);
}

export class Directory {
  private items: FileSystemEntry[] = [];

  getItems() {
    return [...this.items];
  }

  getItem(name: string) {
    return this.items.find((e) => e.name === name) ?? null;
  }

  mkdir(name: string) {
    const newDir = new Directory();
    this.items.push({
      type: FileSystemObjectType.Directory,
      data: newDir,
      name,
    });
    return newDir;
  }

  addItem(item: FileSystemEntry) {
    this.items.push(item);
    return item;
  }
}

export type FileSystemEntry =
  | {
      type: FileSystemObjectType.Directory;
      name: string;
      data: Directory;
    }
  | {
      type: FileSystemObjectType.TextFile;
      name: string;
      data: TextFile;
    }
  | {
      type: FileSystemObjectType.Executable;
      name: string;
      createInstance: () => Executable;
    }
  | {
      type: FileSystemObjectType.Audio;
      name: string;
      data: AudioFile;
    }
  | {
      type: FileSystemObjectType.Image;
      name: string;
      data: ImageFile;
    }
  | {
      type: FileSystemObjectType.Link;
      name: string;
      data: LinkFile;
      openType: LinkOpenType;
    };

export class FileSystem {
  private rootDir: Directory = new Directory();
  private root: FileSystemEntry = {
    type: FileSystemObjectType.Directory,
    name: "/",
    data: this.rootDir,
  };

  constructor() {}

  getAt(path: FileInfo) {
    return this.getAtPath(path.pieces);
  }

  getAtPath(path: string[]): FileSystemEntry | null {
    if (path.length === 0) {
      return this.root;
    }

    let cur = this.rootDir;
    let curPathI = 0;
    while (curPathI < path.length - 1) {
      const items = cur.getItems();
      const found =
        items.find(
          (e) =>
            e.type === FileSystemObjectType.Directory &&
            e.name === path[curPathI],
        ) ?? null;
      if (found && found.type === FileSystemObjectType.Directory) {
        cur = found.data;
        curPathI += 1;
      } else {
        return null;
      }
    }

    const items = cur.getItems();
    const found = items.find((e) => e.name === path[curPathI]) ?? null;
    return found;
  }
}
