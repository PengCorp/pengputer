import { FileTransferManager } from "../Toolbox/FileTransferManager";

import { Executable } from "./FileSystem";
import { PC } from "./PC";

export class FileTransferTest implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }
  async run(args: string[]) {
    const { std } = this.pc;

    std.writeConsole("\nPress enter to start file upload...");
    await std.readConsoleLine();
    try {
      const { name, text } = await FileTransferManager.askForUpload();
      std.writeConsole(
        `File ${name} uploaded successfully.\nContents follow:\n`,
      );
      std.writeConsole(text);
      std.writeConsole("\n");
    } catch (e) {
      std.writeConsole("Upload cancelled.\n");
    }

    std.writeConsole("Press enter to download a file...");
    await std.readConsoleLine();
    await FileTransferManager.presentDownload("Hello!", "hello.txt");

    std.writeConsole("Test done.");
    await std.readConsoleLine();
  }
}
