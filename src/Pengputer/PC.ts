import { Std } from "../Std/Std";
import { FileSystem } from "../FileSystem/FileSystem";

export interface PC {
  fileSystem: FileSystem;
  std: Std;
  reboot: () => Promise<void>;
}
