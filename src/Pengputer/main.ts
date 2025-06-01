import { loadFont9x16 } from "../Screen/font9x16";
import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import { readLine } from "../Functions";

const PATH_SEPARATOR = "/";

declare global {
  interface Window {
    startupNoise: HTMLAudioElement;
  }
}

class Directory {
  private items: FileSystemEntry[] = [];

  getItems() {
    return this.items;
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

class TextFile {
  private data: string;

  constructor() {
    this.data = "";
  }

  getText() {
    return this.data;
  }

  append(text: string) {
    this.data = `${this.data}${text}`;
  }

  replace(text: string) {
    this.data = text;
  }
}

enum FileSystemObjectType {
  Directory = "dir",
  TextFile = "txt",
}

type FileSystemEntry =
  | {
      type: FileSystemObjectType.Directory;
      name: string;
      data: Directory;
    }
  | {
      type: FileSystemObjectType.TextFile;
      name: string;
      data: TextFile;
    };

class FileSystem {
  private rootDir: Directory = new Directory();
  private root: FileSystemEntry = {
    type: FileSystemObjectType.Directory,
    name: "/",
    data: this.rootDir,
  };

  constructor() {
    let newDir = this.rootDir.mkdir("test_folder");
    newDir = this.rootDir.mkdir("test_folder_too");

    newDir = this.rootDir.mkdir("nested");

    newDir.mkdir("inside");

    const pengOSDir = this.rootDir.mkdir("pengos");
    const licenseTxt = new TextFile();
    licenseTxt.replace(
      "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
        "BY VIEWING THIS FILE YOU ARE COMMITING A FELONY UNDER\n" +
        "TITLE 2,239,132 SECTION XII OF THE PENGER CRIMINAL JUSTICE\nCODE"
    );
    pengOSDir.addItem({
      type: FileSystemObjectType.TextFile,
      data: licenseTxt,
      name: "LICENSE.TXT",
    });
  }

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

class PengOS {
  private pc: {
    screen: Screen;
    keyboard: Keyboard;
    currentDrive: string;
    currentPath: string[];
    prompt: string;
    fileSystem: FileSystem;
  };

  constructor(screen: Screen, keyboard: Keyboard) {
    this.pc = {
      screen,
      keyboard,
      currentDrive: "A",
      currentPath: [],
      prompt: "%D%P",
      fileSystem: new FileSystem(),
    };
  }

  startup() {
    window.startupNoise.volume = 0.7;
    window.startupNoise.play();

    const { screen } = this.pc;
    screen.clear();
    screen.printString("PengOS 2.1\n(c) Copyright 1985 PengCorp\n");

    this.pc.currentDrive = "A";
    this.pc.currentPath = [];
    this.pc.prompt = "%D%P>";
  }

  formatPath(path: string[]): string {
    return path.length > 0
      ? `${PATH_SEPARATOR}${path.join(PATH_SEPARATOR)}${PATH_SEPARATOR}`
      : PATH_SEPARATOR;
  }

  printPrompt() {
    const { screen, prompt, currentDrive, currentPath } = this.pc;
    let pathString = this.formatPath(currentPath);
    const promptString = prompt
      .replace("%D", `${currentDrive}:`)
      .replace("%P", pathString);
    screen.printString(`\n${promptString}`);
  }

  private commandPrompt(args: string[]) {
    this.pc.prompt = args[0] ?? "";
  }

  private commandLook() {
    const { fileSystem, currentPath, screen } = this.pc;
    screen.printString(`Currently in ${this.formatPath(currentPath)}\n\n`);
    const entry = fileSystem.getAtPath(currentPath);
    if (entry && entry.type === FileSystemObjectType.Directory) {
      const items = entry.data.getItems();
      if (items.length > 0) {
        for (const directoryEntry of entry.data.getItems()) {
          const isDir = directoryEntry.type === FileSystemObjectType.Directory;
          screen.printString(
            `${directoryEntry.name}${isDir ? PATH_SEPARATOR : ""}\n`
          );
        }
      } else {
        screen.printString(`Directory is empty\n`);
      }
    }
  }

  private commandGo(args: string[]) {
    const [dirName] = args;

    const { fileSystem, currentPath, screen } = this.pc;

    if (!dirName) {
      screen.printString("Must provide a new path\n");
      return;
    }

    const newPath = [...currentPath, dirName];
    const fsEntry = fileSystem.getAtPath(newPath);
    if (fsEntry) {
      if (fsEntry.type === FileSystemObjectType.Directory) {
        this.pc.currentPath = newPath;
        screen.printString(`Now in ${this.formatPath(this.pc.currentPath)}\n`);
      } else {
        screen.printString("Not a directory\n");
      }
    } else {
      screen.printString("Does not exist\n");
    }
  }

  private commandUp() {
    const { currentPath, screen } = this.pc;
    if (currentPath.length > 0) {
      currentPath.splice(currentPath.length - 1, 1);
      screen.printString(`Went up to ${this.formatPath(currentPath)}\n`);
    } else {
      screen.printString("Already at the root of the drive.\n");
    }
  }

  private commandMakedir(args: string[]) {
    const { currentPath, fileSystem, screen } = this.pc;
    const [newDirName] = args;
    if (!newDirName) {
      screen.printString("Must provide a name\n");
    }

    const currentDirEntry = fileSystem.getAtPath(currentPath);
    if (currentDirEntry?.type === FileSystemObjectType.Directory) {
      const currentDir = currentDirEntry.data;
      currentDir.mkdir(newDirName);
      screen.printString("Directory created\n");
    } else {
      screen.printString("Current path is not a directory\n");
    }
  }

  private commandOpen(args: string[]) {
    const { screen, fileSystem, currentPath } = this.pc;
    const [fileName] = args;
    if (!fileName) {
      screen.printString("Must provide a file name\n");
      return;
    }

    const fileEntry = fileSystem.getAtPath([...currentPath, fileName]);
    if (fileEntry) {
      if (fileEntry.type === FileSystemObjectType.TextFile) {
        screen.printString(`${fileEntry.data.getText()}`);
      } else {
        screen.printString(`Not readable\n`);
      }
    } else {
      screen.printString(`Does not exist\n`);
    }
  }

  private commandHelp() {
    const { screen } = this.pc;
    screen.printString("help      List available commands\n");
    screen.printString("look      Display contents of current directory\n");
    screen.printString("go        Navigate directories\n");
    screen.printString("up        Navigate to parent directory\n");
    screen.printString("makedir   Create a directory\n");
    screen.printString("open      Display file\n");
    screen.printString("prompt    Change your command prompt text\n");
  }

  async mainLoop() {
    const { screen, keyboard } = this.pc;

    const commands: Record<string, (args: string[]) => void> = {
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
      look: this.commandLook.bind(this),
      go: this.commandGo.bind(this),
      up: this.commandUp.bind(this),
      makedir: this.commandMakedir.bind(this),
      open: this.commandOpen.bind(this),
      prompt: this.commandPrompt.bind(this),
    };

    while (true) {
      this.printPrompt();
      const commandString = await readLine(screen, keyboard);
      const commandArguments = commandString
        .trim()
        .split(" ")
        .filter((c) => Boolean(c));
      const command = commandArguments[0].toLowerCase();
      const knownCommand = commands[command];
      if (knownCommand) {
        knownCommand(commandArguments.slice(1));
      } else {
        screen.printString("Unknown command: " + commandString + "\n");
        screen.printString('Try "help" or "h" to see available commands\n');
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
  pengOS.startup();
  pengOS.mainLoop();
})();
