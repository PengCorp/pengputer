export enum FileSystemObjectType {
  Directory = "dir",
  TextFile = "txt",
  Executable = "exe",
  Audio = "aud",
  Image = "img",
  Link = "lnk",
  Binary = "bin",
}

export interface Executable {
  run: (args: string[]) => Promise<void>;
}
