import { loadFont9x16 } from "../Screen/font9x16";
import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import { loadImageBitmapFromUrl, waitFor } from "../Functions";
import { Directory, FileSystem, FileSystemObjectType } from "./FileSystem";
import { PC } from "./PC";
import { HelloWorld } from "./HelloWorld";
import { EightBall } from "./EightBall";
import { DateApp } from "./DateApp";
import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { padStart } from "lodash";

import energyStar from "./res/energyStar.png";
import biosPenger from "./res/biosPenger.png";

import canyonOgg from "./files/documents/music/CANYON.ogg";
import mountainKingOgg from "./files/documents/music/mountainking.ogg";
import passportOgg from "./files/documents/music/PASSPORT.ogg";
import nerdgerPng from "./files/documents/pengers/nerdger.png";
import macgerPng from "./files/documents/pengers/macger.png";
import { ImageFile, TextFile, AudioFile, LinkFile } from "./fileTypes";
import { argparse } from "../Functions/argparse";
import { PrintArgs } from "./PrintArgs";
import { TetrisApp } from "./Tetris";
import { Std } from "../Std";

const PATH_SEPARATOR = "/";

declare global {
  interface Window {
    startupNoise: HTMLAudioElement;
  }
}

interface TakenProgram {
  path: Array<string>;
  name: string;
}

class PengOS {
  private pc: PC;

  private suppressNextPromptNewline: boolean;
  private takenPrograms: Array<TakenProgram>;

  constructor(screen: Screen, keyboard: Keyboard) {
    const std = new Std(screen, keyboard);
    this.pc = {
      currentDrive: "C",
      currentPath: [],
      prompt: "%D%P",
      fileSystem: new FileSystem(),
      std,
    };
    this.takenPrograms = [];

    this.suppressNextPromptNewline = false;
  }

  async startup() {
    this.pc.currentDrive = "C";
    this.pc.currentPath = [];
    this.pc.prompt = "%D%P>";

    const rootDirEntry = this.pc.fileSystem.getAtPath([])!;
    const rootDir =
      rootDirEntry.type === FileSystemObjectType.Directory && rootDirEntry.data;

    if (!rootDir) {
      throw new Error("Root dir is undefined.");
    }

    rootDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "date.exe",
      createInstance: () => new DateApp(this.pc),
    });

    const pengOSDir = rootDir.mkdir("pengos");
    const licenseTxt = new TextFile();
    licenseTxt.replace(
      "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
        "BY VIEWING THIS FILE YOU ARE COMMITTING A FELONY UNDER TITLE 2,239,132 SECTION\n" +
        "XII OF THE PENGER CRIMINAL JUSTICE CODE"
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: licenseTxt,
      name: "LICENSE.TXT",
    });
    const pplTxt = new TextFile();
    pplTxt.replace(
      `Penger Public License (PPL)\n\nNo copyright.\nIf you are having fun, you are allowed to use and distribute whatever you want.\nYou can't forbid anyone to use Penger freely.\nNo requirements.`
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: pplTxt,
      name: "PPL.TXT",
    });

    const softwareDir = rootDir.mkdir("software");
    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "hello.exe",
      createInstance: () => new HelloWorld(this.pc),
    });

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "8ball.exe",
      createInstance: () => new EightBall(this.pc),
    });

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "args.exe",
      createInstance: () => new PrintArgs(this.pc),
    });

    softwareDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "ped.exe",
      createInstance: () => new Ped(this.pc),
    });

    const gamesDir = rootDir.mkdir("games");
    gamesDir.addItem({
      type: FileSystemObjectType.Link,
      name: "pongr.exe",
      data: new LinkFile("https://penger.city/pongerslair/"),
      openType: "run",
    });
    gamesDir.addItem({
      type: FileSystemObjectType.Executable,
      name: "pengtris.exe",
      createInstance: () => new TetrisApp(this.pc),
    });

    const documentsDir = rootDir.mkdir("documents");
    const musicDir = documentsDir.mkdir("music");
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "CANYON.MID",
      data: new AudioFile(canyonOgg),
    });
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "PASSPORT.MID",
      data: new AudioFile(passportOgg),
    });
    musicDir.addItem({
      type: FileSystemObjectType.Audio,
      name: "mountainking.mid",
      data: new AudioFile(mountainKingOgg),
    });

    const pengersDir = documentsDir.mkdir("pengers");
    pengersDir.addItem({
      type: FileSystemObjectType.Image,
      name: "macger.png",
      data: new ImageFile(macgerPng),
    });
    pengersDir.addItem({
      type: FileSystemObjectType.Image,
      name: "nerdger.png",
      data: new ImageFile(nerdgerPng),
    });

    await this.runStartupAnimation();
  }

  private async runStartupAnimation() {
    const { std } = this.pc;
    std.clearConsole();
    if (!localStorage.getItem("hasStartedUp")) {
      window.startupNoise.volume = 0.7;
      window.startupNoise.play();
      std.setIsConsoleCursorVisible(false);
      std.drawConsoleImage(await loadImageBitmapFromUrl(energyStar), -135, 0);

      std.writeConsole("    Penger Modular BIOS v5.22, An Energy Star Ally\n");
      std.writeConsole("    Copyright (C) 1982-85, PengCorp\n");
      std.writeConsole("\n");
      std.drawConsoleImage(await loadImageBitmapFromUrl(biosPenger), 0, 0);
      const curPos = std.getConsoleCursorPosition();
      std.setConsoleCursorPosition({ x: 0, y: 24 });
      std.writeConsole("05/02/1984-ALADDIN5-P2B");
      std.setConsoleCursorPosition(curPos);
      await waitFor(1000);
      std.writeConsole("AMD-K6(rm)-III/450 Processor\n");
      std.writeConsole("Memory Test :        ");
      await waitFor(500);
      for (let i = 0; i <= 262144; i += 1024) {
        std.moveConsoleCursorBy({ x: -7, y: 0 });
        std.writeConsole(`${padStart(String(i), 6, " ")}K`);
        await waitFor(7);
      }
      await waitFor(500);
      std.writeConsole(` OK\n`);
      std.writeConsole("\n");
      await waitFor(750);
      std.writeConsole("Initialize Plug and Play Cards...\n");
      await waitFor(1000);
      std.writeConsole("PNP Init Completed");
      await waitFor(2500);
      std.clearConsole();
      std.writeConsole(
        "╔═══════════════════════════════════════════════════════════════════════════╗\n"
      );
      std.writeConsole(
        "║            PBIOS System Configuration (C) 1982-1985, PengCorp             ║\n"
      );
      std.writeConsole(
        "╠═════════════════════════════════════╤═════════════════════════════════════╣\n"
      );
      std.writeConsole(
        "║ Main Processor     : AMD-K6-III     │ Base Memory Size   : 640 KB         ║\n"
      );
      std.writeConsole(
        "║ Numeric Processor  : Present        │ Ext. Memory Size   : 261504 KB      ║\n"
      );
      std.writeConsole(
        "║ Floppy Drive A:    : None           │ Hard Disk C: Type  : 47             ║\n"
      ); // 1.44 MB, 3½"
      std.writeConsole(
        "║ Floppy Drive B:    : None           │ Hard Disk D: Type  : None           ║\n"
      );
      std.writeConsole(
        "║ Display Type       : VGA/PGA/EGA    │ Serial Port(s)     : 3F8, 2F8       ║\n"
      );
      std.writeConsole(
        "║ PBIOS Date         : 11/11/85       │ Parallel Port(s)   : 378            ║\n"
      );
      std.writeConsole(
        "╚═════════════════════════════════════╧═════════════════════════════════════╝\n"
      );
      await waitFor(1500);
      std.writeConsole("Starting PengOS...\n\n");
      await waitFor(1000);
      localStorage.setItem("hasStartedUp", "yes");
    }

    std.writeConsole("PengOS 2.1\n(c) Copyright 1985 PengCorp\n");

    std.setIsConsoleCursorVisible(true);
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
    currentAttributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
    currentAttributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];
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

  private commandPrompt(args: string[]) {
    const { std } = this.pc;
    if (args.length === 0) {
      std.writeConsole(`${this.pc.prompt}\n`);
      return;
    }
    this.pc.prompt = args[0];
  }

  private commandLook() {
    const { fileSystem, currentPath, std } = this.pc;
    std.writeConsole(
      `Currently in ${this.pc.currentDrive}:${this.formatPath(currentPath)}\n\n`
    );
    const entry = fileSystem.getAtPath(currentPath);
    if (entry && entry.type === FileSystemObjectType.Directory) {
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
    }
  }

  private commandGo(args: string[]) {
    const [dirName] = args;

    const { fileSystem, currentPath, std } = this.pc;

    if (!dirName) {
      std.writeConsole("Must provide a new path\n");
      return;
    }

    const newPath = [...currentPath, dirName];
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

    const fileEntry = fileSystem.getAtPath([...currentPath, fileName]);
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
          const screenSize = std.getConsoleSize();
          std.moveConsoleCursorBy({
            x: 0,
            y: Math.ceil(image.height / screenSize.h),
          });
        }
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

  private commandClear() {
    const { std } = this.pc;
    std.clearConsole();
    this.suppressNextPromptNewline = true;
  }

  private async commandReboot() {
    localStorage.removeItem("hasStartedUp");
    await this.runStartupAnimation();
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
    std.writeConsole("\x1Bbshelp      \x1BbrList available commands\n");
    std.writeConsole("\x1Bbshistory   \x1BbrView previously run commands\n");
    std.writeConsole(
      "\x1Bbslook      \x1BbrDisplay contents of current directory\n"
    );
    std.writeConsole("\x1Bbsgo        \x1BbrNavigate directories\n");
    std.writeConsole("\x1Bbsup        \x1BbrNavigate to parent directory\n");
    std.writeConsole("\x1Bbsmakedir   \x1BbrCreate a directory\n");
    std.writeConsole("\x1Bbsrun       \x1BbrExecute program\n");
    std.writeConsole("\x1Bbsopen      \x1BbrDisplay file\n");
    std.writeConsole("\x1Bbsclear     \x1BbrClear screen\n");
    std.writeConsole("\x1Bbsprompt    \x1BbrChange your command prompt text\n");
    std.writeConsole(
      "\x1Bbstake      \x1BbrAdd a program to the command list\n"
    );
    std.writeConsole(
      "\x1Bbsdrop      \x1BbrRemove a program from the command list\n"
    );
    std.writeConsole("\x1Bbsreboot    \x1BbrRestart the system\n");

    if (this.takenPrograms.length > 0) {
      std.writeConsole("\nAvailable programs:\n");
      for (const takenProgram of this.takenPrograms) {
        std.writeConsole(`${takenProgram.name}\n`);
      }
    }
  }

  async mainLoop() {
    const { std, fileSystem } = this.pc;

    let previousEntries: string[] = [];

    const commands: Record<string, (args: string[]) => void | Promise<void>> = {
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
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

    while (true) {
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
        (await std.readConsoleLine({
          autoCompleteStrings,
          previousEntries,
        })) ?? "";
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
}

(async () => {
  await loadFont9x16();

  const screen = new Screen();
  await screen.init(document.getElementById("screen-container")!);

  const keyboard = new Keyboard();

  let lastTime = performance.now();
  const cb = () => {
    const dt = performance.now() - lastTime;
    lastTime = performance.now();
    screen.draw(dt);
    keyboard.update(dt);
    requestAnimationFrame(cb);
  };
  requestAnimationFrame(cb);

  const pengOS = new PengOS(screen, keyboard);
  await pengOS.startup();
  pengOS.mainLoop();
})();
