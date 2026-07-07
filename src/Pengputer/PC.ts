import { Std } from "../Std/Std";
import { FileSystem } from "../FileSystem";
import type { Keyboard } from "@src/Keyboard";

export interface PC {
    fileSystem: FileSystem;
    std: Std;
    keyboard: Keyboard;
    reboot: () => Promise<void>;
}
