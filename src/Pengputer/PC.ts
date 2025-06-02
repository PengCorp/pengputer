import { Keyboard } from "../Keyboard";
import { Screen } from "../Screen";
import { FileSystem } from "./FileSystem";

export interface PC {
  screen: Screen;
  keyboard: Keyboard;
  currentDrive: string;
  currentPath: string[];
  prompt: string;
  fileSystem: FileSystem;
}
