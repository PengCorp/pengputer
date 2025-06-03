import { AudioFile } from "./AudioFile";
import { TextFile } from "./TextFile";

export enum FileSystemObjectType {
  Directory = "dir",
  TextFile = "txt",
  Executable = "exe",
  Audio = "aud",
}

export interface Executable {
  run: (args: string[]) => Promise<void>;
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
      data: Executable;
    }
  | {
      type: FileSystemObjectType.Audio;
      name: string;
      data: AudioFile;
    };

export class FileSystem {
  private rootDir: Directory = new Directory();
  private root: FileSystemEntry = {
    type: FileSystemObjectType.Directory,
    name: "/",
    data: this.rootDir,
  };

  constructor() {}

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
            e.name === path[curPathI]
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
