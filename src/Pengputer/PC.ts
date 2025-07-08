import { Std } from "../Std/Std";
import { FileSystem } from "./FileSystem";

export interface PC {
  currentDrive: string;
  currentPath: string[];
  prompt: string;
  fileSystem: FileSystem;
  std: Std;
}
