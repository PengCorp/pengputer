/**
 * Author: Jack (jack-jjm@github), Strawberry (Strawberry@discord), Nashiora (nashiora@discord / echoephile@github)
 * Description: Implements the PengerShell environment.
 */

import { Executable } from "./FileSystem";
import { FileSystem, FileSystemObjectType } from "./FileSystem";
import { PATH_SEPARATOR, FilePath } from "./FileSystem";
import { PC } from "./PC";

import { argparse } from "../Toolbox/argparse";

import { classicColors } from "../Color/ansi";

import _ from "lodash";

interface TakenProgram {
  path: FilePath;
  name: string;
}

export class PengerShell implements Executable {
  private pc: PC;

  private isRunning: boolean = false;

  private workingDirectories: { [id: string]: FilePath } = {};
  private currentDrive: string = "C";
  private currentPath: string[] = [];
  private prompt: string = "%P>";

  private suppressNextPromptNewline: boolean = false;
  private takenPrograms: Array<TakenProgram> = [];

  private autorun: Array<string>;

  constructor(pc: PC) {
    this.pc = pc;

    const searchParams = new URLSearchParams(window.location.search);
    const autorunString = searchParams.get("autorun");
    if (autorunString) {
      this.autorun = autorunString.split("/");
    } else {
      this.autorun = [];
    }
  }

  private get workingDirectory(): FilePath {
    let wd = this.workingDirectories[this.currentDrive];
    if (!wd) {
      this.workingDirectories[this.currentDrive] = wd = FilePath.tryParse(
        `${this.currentDrive}:/`,
      )!;
    }
    return wd;
  }

  private set workingDirectory(wd: FilePath) {
    const drive = wd.drive;
    this.workingDirectories[!!drive ? drive : "C"] = wd;
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
      fullpath: this.commandFullpath.bind(this),
    };

    this.isRunning = true;

    std.writeConsoleCharacter("penger00");
    std.writeConsoleCharacter("penger01");
    std.writeConsoleCharacter("penger02");
    std.writeConsole(" PengOS 2.1\n");
    std.writeConsoleCharacter("penger10");
    std.writeConsoleCharacter("penger11");
    std.writeConsoleCharacter("penger12");
    std.writeConsole(" (c) Copyright 1985 PengCorp\n");

    std.setIsConsoleCursorVisible(true);

    while (this.isRunning) {
      this.printPrompt();
      let autoCompleteStrings = [...this.takenPrograms.map((p) => p.name)];

      const entry = fileSystem.getFileInfo(this.workingDirectory);
      if (entry && entry.type === FileSystemObjectType.Directory) {
        const entries = entry.entries;
        autoCompleteStrings = [
          ...autoCompleteStrings,
          ...entries.map((i) => i.name),
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
          (p) => p.name === commandName,
        );
        if (knownCommand) {
          await knownCommand(args.slice(1));
          std.resetConsole();
        } else if (knownTakenApp) {
          const app = fileSystem.getFileInfo(knownTakenApp.path);
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

  printPrompt() {
    const { std } = this.pc;
    const { prompt, currentDrive, currentPath } = this;

    std.setIsConsoleCursorVisible(true);

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.fgColor = classicColors[7];
    currentAttributes.bgColor = classicColors[0];
    std.setConsoleAttributes(currentAttributes);

    let pathString = this.workingDirectory.toString();
    const promptString = prompt.replace("%P", pathString);
    std.writeConsole(
      `${this.suppressNextPromptNewline ? "" : "\n"}${promptString}`,
    );
    this.suppressNextPromptNewline = false;
  }

  private getCanonicalPath(
    relativeToPath: FilePath,
    inputPath: string | null,
  ): FilePath | null {
    const inputFilePath = FilePath.tryParse(inputPath ?? "", this.currentDrive);
    if (inputFilePath === null) return null;

    if (inputFilePath.isRelative()) {
      return relativeToPath.combine(inputFilePath);
    } else return inputFilePath;
  }

  private commandExit(args: string[]) {
    this.isRunning = false;
  }

  private commandPrompt(args: string[]) {
    const { std } = this.pc;
    if (args.length === 0) {
      std.writeConsole(`${this.prompt}\n`);
      return;
    }
    this.prompt = args[0];
  }

  private commandLook(args: string[]) {
    const { fileSystem, std } = this.pc;
    const [dirName] = args;

    const lookPath = this.getCanonicalPath(this.workingDirectory, dirName);
    if (lookPath === null) {
      std.writeConsole(`Can't find ${dirName}\n\n`);
      return;
    }

    const entry = fileSystem.getFileInfo(lookPath);

    std.writeConsole(`Looking in ${lookPath.toString()}\n\n`);
    if (entry) {
      if (entry.type === FileSystemObjectType.Directory) {
        const entries = [...entry.entries];
        if (entries.length > 0) {
          entries.sort((a, b) => {
            if (a.name === b.name) {
              return 0;
            }
            if (b.name > a.name) {
              return -1;
            }
            return 1;
          });
          entries.sort((a, b) => {
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
          for (const directoryEntry of entries) {
            const isDir =
              directoryEntry.type === FileSystemObjectType.Directory;
            std.writeConsole(
              `${directoryEntry.name}${isDir ? PATH_SEPARATOR : ""}\n`,
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
    const { fileSystem, std } = this.pc;
    const [dirName] = args;

    if (!dirName) {
      std.writeConsole("Must provide a new path\n");
      return;
    }

    const newPath = this.getCanonicalPath(this.workingDirectory, dirName);
    if (newPath === null) {
      std.writeConsole(`Can't find ${dirName}\n\n`);
      return;
    }

    if (newPath.drive !== "C") {
      std.writeConsole("Cannot leave drive C\n");
      return;
    }

    const fsEntry = fileSystem.getFileInfo(newPath);
    if (fsEntry) {
      if (fsEntry.type === FileSystemObjectType.Directory) {
        this.workingDirectory = newPath;
        std.writeConsole(`Now in ${this.workingDirectory.toString()}\n`);
      } else {
        std.writeConsole("Not a directory\n");
      }
    } else {
      std.writeConsole("Does not exist\n");
    }
  }

  private commandUp() {
    const { workingDirectory } = this;
    const { std } = this.pc;
    this.workingDirectory = workingDirectory.parentDirectory();
    if (
      workingDirectory.pieces.length !== this.workingDirectory.pieces.length
    ) {
      std.writeConsole(`Went up to ${this.workingDirectory.toString()}\n`);
    } else {
      std.writeConsole("Already at the root of the drive.\n");
    }
  }

  private commandMakeDir(args: string[]) {
    const { fileSystem, std } = this.pc;
    if (args.length === 0) {
      std.writeConsole("Must provide a name\n");
    }

    for (let i = 0; i < args.length; i++) {
      const newDirPath = this.getCanonicalPath(this.workingDirectory, args[i]);
      if (newDirPath === null) {
        std.writeConsole(`Can't find ${args[i]}\n\n`);
        continue;
      }

      if (newDirPath.drive !== "C") {
        std.writeConsole("Cannot leave drive C\n");
        continue;
      }

      const pieces = newDirPath.pieces;
      for (let pathIndex = 0; pathIndex < pieces.length; pathIndex++) {
        const nextDirPath = FilePath.tryParse(
          `${newDirPath.drive}:/${pieces.slice(0, pathIndex + 1).join("/")}`,
        )!;
        const nextDirEntry = fileSystem.getFileInfo(nextDirPath);

        if (nextDirEntry === null) {
          const prevDirEntry = fileSystem.getFileInfo(
            nextDirPath.parentDirectory(),
          )!;
          if (
            prevDirEntry !== null &&
            prevDirEntry.type === FileSystemObjectType.Directory
          ) {
            prevDirEntry.mkdir(pieces[pathIndex]);
          }
        } else if (nextDirEntry.type !== FileSystemObjectType.Directory) {
          std.writeConsole(
            `Path ${nextDirPath.toString()} is not a directory\n`,
          );
          continue;
        }
      }

      std.writeConsole(`Directory ${newDirPath.toString()} created\n`);
    }
  }

  private async commandRun(args: string[]) {
    const { std, fileSystem } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const path = this.getCanonicalPath(this.workingDirectory, fileName);
    if (path === null) {
      std.writeConsole(`Can't find ${fileName}\n\n`);
      return;
    }

    const fileEntry = fileSystem.getFileInfo(path);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.Executable) {
        await fileEntry.createInstance().run(args);
      } else if (
        fileEntry.type === FileSystemObjectType.Link &&
        fileEntry.openType === "run"
      ) {
        std.writeConsole("Running...\n");
        fileEntry.data.open();
      } else {
        std.writeConsole(`Not executable\n`);
      }
    } else {
      std.writeConsole(`Does not exist\n`);
    }
  }

  private async commandOpen(args: string[]) {
    const { currentPath } = this;
    const { std, fileSystem } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      std.writeConsole("Must provide a file name\n");
      return;
    }

    const path = this.getCanonicalPath(this.workingDirectory, fileName);
    if (path === null) {
      std.writeConsole(`Can't find ${fileName}\n\n`);
      return;
    }

    const fileEntry = fileSystem.getFileInfo(path);
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
    this.pc.reboot();
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
    const path = this.getCanonicalPath(this.workingDirectory, argsName);
    if (path === null) {
      std.writeConsole(`Can't find ${argsName}\n\n`);
      return;
    }
    const { pieces } = path;
    if (pieces.length == 0) {
      std.writeConsole(`Invalid path provided\n`);
      return;
    }
    const lastPathName = pieces[pieces.length - 1];
    const strippedNameMatch = lastPathName.match(/^[^.]+/);
    if (!strippedNameMatch) {
      std.writeConsole(`Invalid name provided\n`);
      return;
    }
    const target = fileSystem.getFileInfo(path);
    if (!target) {
      std.writeConsole("Program not found\n");
      return;
    }
    if (target.type !== FileSystemObjectType.Executable) {
      std.writeConsole("Not executable\n");
      return;
    }
    const strippedSplit = strippedNameMatch[0].split("/");
    const strippedName = strippedSplit[strippedSplit.length - 1];
    let candidateName = strippedName;
    let dedupIndex = 0;
    while (this.takenPrograms.find((p) => p.name === candidateName)) {
      dedupIndex += 1;
      candidateName = `${strippedName}~${dedupIndex}`;
    }

    std.writeConsole(
      `Added "${argsName}" as "${candidateName}" to command list\n`,
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
      std.writeConsole(`"${name}" not found in the taken command list\n`);
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
      std.writeConsoleSequence([
        { bold: true },
        _.padEnd(cmd, 10) + " ",
        { reset: true },
        text,
      ]);
    };

    printEntry("help", "List available commands\n");
    printEntry("exit", "Exit this shell instance\n");
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

  private commandFullpath(args: string[]) {
    const { std } = this.pc;
    const [input] = args;
    const path = this.getCanonicalPath(
      this.workingDirectory,
      !!input ? input : "",
    )!;
    std.writeConsole(`${path.toString()}\n`);
  }
}
