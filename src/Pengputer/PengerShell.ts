/**
 * Author: Strawberry / nashiora@github / echoephile@github
 * Description: Implements the
 */

import { Executable } from "./FileSystem";
import { FileSystem, FileSystemObjectType } from "./FileSystem";
import { PC } from "./PC";

import { argparse } from "../Toolbox/argparse";

import { classicColors } from "../Color/ansi";

const PATH_SEPARATOR = "/";

export class PengerShell implements Executable {
  private pc: PC;
  private rebootCallback: () => Promise<void>;

  private isRunning: boolean;

  private suppressNextPromptNewline: boolean;
  private takenPrograms: Array<TakenProgram>;

  private autorun: Array<string>;

  constructor(pc: PC, rebootCallback: () => Promise<void>) {
    this.pc = pc;
    this.rebootCallback = rebootCallback;
    this.takenPrograms = [];
    this.suppressNextPromptNewline = false;

    const searchParams = new URLSearchParams(window.location.search);
    const autorunString = searchParams.get("autorun");
    if (autorunString) {
      this.autorun = autorunString.split("/");
    } else {
      this.autorun = [];
    }
  }

  private shiftAutorunCommand() {
    if (this.autorun.length > 1) {
      return `go ${this.autorun.shift()}`;
    }

    if (this.autorun.length === 1) {
      return `run ${this.autorun.shift()}`;
    }

    return undefined;
  }

  async run(args: string[]) {
    const { std, fileSystem } = this.pc;
    let previousEntries: string[] = [];

    const commands: Record<string, (args: string[]) => void | Promise<void>> = {
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
      exit: this.commandExit.bind(this),
      history: (args) => this.commandHistory(args, previousEntries),
      look: this.commandLook.bind(this),
      go: this.commandGo.bind(this),
      up: this.commandUp.bind(this),
      makedir: this.commandMakeDir.bind(this),
      run: this.commandRun.bind(this),
      open: this.commandOpen.bind(this),
      clear: this.commandClear.bind(this),
      prompt: this.commandPrompt.bind(this),
      take: this.commandTake.bind(this),
      drop: this.commandDrop.bind(this),
      reboot: this.commandReboot.bind(this),
    };

    this.pc.currentDrive = "C";
    this.pc.currentPath = [];
    this.pc.prompt = "%D%P>";

    this.isRunning = true;

    std.writeConsole("PengOS 2.1\n(c) Copyright 1985 PengCorp\n");
    std.setIsConsoleCursorVisible(true);

    while (this.isRunning) {
      this.printPrompt();
      let autoCompleteStrings = [...this.takenPrograms.map((p) => p.name)];

      const entry = fileSystem.getAtPath(this.pc.currentPath);
      if (entry && entry.type === FileSystemObjectType.Directory) {
        const items = entry.data.getItems();
        autoCompleteStrings = [
          ...autoCompleteStrings,
          ...items.map((i) => i.name),
        ];
      }

      autoCompleteStrings = [
        ...autoCompleteStrings,
        "help",
        "exit",
        "history",
        "look",
        "go",
        "up",
        "makedir",
        "run",
        "open",
        "clear",
        "prompt",
        "take",
        "drop",
        "reboot",
      ];

      const commandString =
        this.shiftAutorunCommand() ??
        (await std.readConsoleLine({
          autoCompleteStrings,
          previousEntries,
        })) ??
        "";
      const trimmedCommandString = commandString.trim();
      if (trimmedCommandString.length > 0) {
        previousEntries.push(commandString);
        if (previousEntries.length > 16) {
          previousEntries = previousEntries.slice(1);
        }
      }
      const args = argparse(commandString);
      const commandName = args[0];
      if (commandName) {
        const knownCommand = commands[commandName.toLowerCase()];
        const knownTakenApp = this.takenPrograms.find(
          (p) => p.name === commandName
        );
        if (knownCommand) {
          await knownCommand(args.slice(1));
          std.resetConsole();
        } else if (knownTakenApp) {
          const app = fileSystem.getAtPath(knownTakenApp.path);
          if (app && app.type === FileSystemObjectType.Executable) {
            await app.createInstance().run(args);
            std.resetConsole();
          } else {
            std.writeConsole(`Executable not found. Consider dropping`);
          }
        } else {
          std.writeConsole("Unknown command: " + commandName + "\n");
          std.writeConsole('Try "help" or "h" to see available commands\n');
        }
      }
    }
  }

  formatPath(path: string[]): string {
    return path.length > 0
      ? `${PATH_SEPARATOR}${path.join(PATH_SEPARATOR)}${PATH_SEPARATOR}`
      : PATH_SEPARATOR;
  }

  printPrompt() {
    const { std, prompt, currentDrive, currentPath } = this.pc;
    std.setIsConsoleCursorVisible(true);

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.fgColor = classicColors[7];
    currentAttributes.bgColor = classicColors[0];
    std.setConsoleAttributes(currentAttributes);

    let pathString = this.formatPath(currentPath);
    const promptString = prompt
      .replace("%D", `${currentDrive}:`)
      .replace("%P", pathString);
    std.writeConsole(
      `${this.suppressNextPromptNewline ? "" : "\n"}${promptString}`
    );
    this.suppressNextPromptNewline = false;
  }

  private commandExit(args: string[]) {
    this.isRunning = false;
  }

  private commandPrompt(args: string[]) {
    const { std } = this.pc;
    if (args.length === 0) {
      std.writeConsole(`${this.pc.prompt}\n`);
      return;
    }
    this.pc.prompt = args[0];
  }

  private commandLook(args: string[]) {
    const { fileSystem, currentPath, std } = this.pc;
    const [dirName] = args;

    const lookPath = !!dirName
      ? [...currentPath, ...dirName.split("/")]
      : currentPath;
    const entry = fileSystem.getAtPath(lookPath);

    std.writeConsole(
      `Looking in ${this.pc.currentDrive}:${this.formatPath(lookPath)}\n\n`
    );
    if (entry) {
      if (entry.type === FileSystemObjectType.Directory) {
        const items = entry.data.getItems();
        if (items.length > 0) {
          const items = entry.data.getItems();
          items.sort((a, b) => {
            if (a.name === b.name) {
              return 0;
            }
            if (b.name > a.name) {
              return -1;
            }
            return 1;
          });
          items.sort((a, b) => {
            if (
              a.type === FileSystemObjectType.Directory &&
              b.type === FileSystemObjectType.Directory
            ) {
              return 0;
            }
            if (
              a.type === FileSystemObjectType.Directory &&
              b.type !== FileSystemObjectType.Directory
            ) {
              return -1;
            }
            return 1;
          });
          for (const directoryEntry of items) {
            const isDir = directoryEntry.type === FileSystemObjectType.Directory;
            std.writeConsole(
              `${directoryEntry.name}${isDir ? PATH_SEPARATOR : ""}\n`
            );
          }
        } else {
          std.writeConsole(`Directory is empty\n`);
        }
      } else {
        std.writeConsole("Not a directory\n");
      }
    } else {
      std.writeConsole("Does not exist\n");
    }
  }

  private commandGo(args: string[]) {
    const [dirName] = args;

    const { fileSystem, currentPath, std } = this.pc;

    if (!dirName) {
      std.writeConsole("Must provide a new path\n");
      return;
    }

    const newPath = [...currentPath, ...dirName.split("/")];
    const fsEntry = fileSystem.getAtPath(newPath);
    if (fsEntry) {
      if (fsEntry.type === FileSystemObjectType.Directory) {
        this.pc.currentPath = newPath;
        std.writeConsole(
          `Now in ${this.pc.currentDrive}:${this.formatPath(
            this.pc.currentPath
          )}\n`
        );
      } else {
        std.writeConsole("Not a directory\n");
      }
    } else {
      std.writeConsole("Does not exist\n");
    }
  }

  private commandUp() {
    const { currentPath, std } = this.pc;
    if (currentPath.length > 0) {
      currentPath.splice(currentPath.length - 1, 1);
      std.writeConsole(
        `Went up to ${this.pc.currentDrive}:${this.formatPath(currentPath)}\n`
      );
    } else {
      std.writeConsole("Already at the root of the drive.\n");
    }
  }

  private commandMakeDir(args: string[]) {
    const { currentPath, fileSystem, std } = this.pc;
    const [newDirName] = args;
    if (!newDirName) {
      std.writeConsole("Must provide a name\n");
    }

    const currentDirEntry = fileSystem.getAtPath(currentPath);
    if (currentDirEntry?.type === FileSystemObjectType.Directory) {
      const currentDir = currentDirEntry.data;
      currentDir.mkdir(newDirName);
      std.writeConsole("Directory created\n");
    } else {
      std.writeConsole("Current path is not a directory\n");
    }
  }

  private async commandRun(args: string[]) {
    const { std, fileSystem, currentPath } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const fileEntry = fileSystem.getAtPath([...currentPath, fileName]);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.Executable) {
        await fileEntry.createInstance().run(args);
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "run"
      ) {
        std.writeConsole("Running...\n");
        await std.waitForKeyboardKeysUp();
        fileEntry.data.open();
      } else {
        std.writeConsole(`Not executable\n`);
      }
    } else {
      std.writeConsole(`Does not exist\n`);
    }
  }

  private async commandOpen(args: string[]) {
    const { std, fileSystem, currentPath } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const fileEntry = fileSystem.getAtPath([...currentPath, ...fileName.split("/")]);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.TextFile) {
        std.writeConsole(`${fileEntry.data.getText()}`);
      } else if (fileEntry.type === FileSystemObjectType.Audio) {
        std.writeConsole(`Playing ${fileEntry.name}...\n`);
        std.writeConsole(`Press any key to exit.`);
        fileEntry.data.play();
        await std.readConsoleKey();
        fileEntry.data.stop();
        std.writeConsole(`\n`);
      } else if (fileEntry.type === FileSystemObjectType.Image) {
        std.clearConsole();
        const image = await fileEntry.data.load();
        if (image) {
          std.drawConsoleImage(image, 0, 0);
          const characterSize = std.getConsoleCharacterSize();
          std.moveConsoleCursorBy({
            x: 0,
            y: Math.ceil(image.height / characterSize.h),
          });
        }
        std.writeConsole("Press ENTER to continue...");
        await std.readConsoleLine();
        std.resetConsole();
        std.clearConsole();
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "open"
      ) {
        std.writeConsole("Opening...\n");
        await std.waitForKeyboardKeysUp();
        fileEntry.data.open();
      } else {
        std.writeConsole(`Not readable\n`);
      }
    } else {
      std.writeConsole(`Does not exist\n`);
    }
  }

  private async commandReboot() {
    this.isRunning = false;
    this.rebootCallback();
  }

  private commandClear() {
    const { std } = this.pc;
    std.clearConsole();
    this.suppressNextPromptNewline = true;
  }

  private commandTake(args: string[]) {
    const { std, fileSystem } = this.pc;
    const [argsName] = args;
    if (!argsName) {
      std.writeConsole(`Must provide name\n`);
      return;
    }
    const strippedNameMatch = argsName.match(/^[^.]+/);
    if (!strippedNameMatch) {
      std.writeConsole(`Invalid name provided\n`);
      return;
    }
    const path = [...this.pc.currentPath, argsName];
    const target = fileSystem.getAtPath(path);
    if (!target) {
      std.writeConsole("Program not found\n");
      return;
    }
    if (target.type !== FileSystemObjectType.Executable) {
      std.writeConsole("Not executable\n");
      return;
    }
    const strippedName = strippedNameMatch[0];
    let candidateName = strippedName;
    let dedupIndex = 0;
    while (this.takenPrograms.find((p) => p.name === candidateName)) {
      dedupIndex += 1;
      candidateName = `${strippedName}~${dedupIndex}`;
    }

    std.writeConsole(
      `Added "${argsName}" as "${candidateName}" to command list\n`
    );
    this.takenPrograms.push({
      name: candidateName,
      path,
    });
  }

  private commandDrop(args: string[]) {
    const { std } = this.pc;
    const [name] = args;
    if (!name) {
      std.writeConsole("Must provide a name\n");
      return;
    }
    const filteredPrograms = this.takenPrograms.filter((p) => p.name !== name);
    if (filteredPrograms.length < this.takenPrograms.length) {
      std.writeConsole(`"${name}" dropped from command list\n`);
    } else {
      std.writeConsole(`"${name} not found in the taken command list\n`);
    }
  }

  private commandHistory(args: string[], previousEntries: string[]) {
    const { std } = this.pc;
    std.writeConsole(`Last run commands:\n`);
    for (const cmd of previousEntries) {
      std.writeConsole(`${cmd}\n`);
    }
  }

  private commandHelp() {
    const { std } = this.pc;

    const printEntry = (cmd: string, text: string) => {
      std.updateConsoleAttributes({ bold: true });
      std.writeConsole(_.padEnd(cmd, 10) + " ");
      std.resetConsoleAttributes();
      std.writeConsole(text);
    };

    printEntry("help", "List available commands\n");
    printEntry("history", "View previously run commands\n");
    printEntry("look", "Display contents of current directory\n");
    printEntry("go", "Navigate directories\n");
    printEntry("up", "Navigate to parent directory\n");
    printEntry("makedir", "Create a directory\n");
    printEntry("run", "Execute program\n");
    printEntry("open", "Display file\n");
    printEntry("clear", "Clear screen\n");
    printEntry("prompt", "Change your command prompt text\n");
    printEntry("take", "Add a program to the command list\n");
    printEntry("drop", "Remove a program from the command list\n");
    printEntry("reboot", "Restart the system\n");

    if (this.takenPrograms.length > 0) {
      std.writeConsole("\nAvailable programs:\n");
      for (const takenProgram of this.takenPrograms) {
        std.writeConsole(`${takenProgram.name}\n`);
      }
    }
  }
}
