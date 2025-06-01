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

const programs = {
  pong: function () {
    window.open("/pongerslair", "_blank");
    pc.screen.printString("PONG for PengOS (c) 1988 Ponger");
  },

  date: function () {
    print(new Date().toDateString());
  },

  funk: async function () {
    print("Playing CANYON.MID...");
    canyonSong.fastSeek(0);
    canyonSong.play();
    await pressAnyKey();
    canyonSong.pause();
  },
};

const Program = Symbol();

class Document {}

class Image extends Document {
  constructor(name, url) {
    super();
    this.name = name;
    this.url = url;
  }

  open() {
    window.open(this.url, "_blank");
    print(`Opening ${this.name}...`);
    print("Check your web browser's pop-up settings if nothing appears...");
    print("");
    print("...hey!");
    print("What's a web browser?");
  }
}

class AudioFile extends Document {
  constructor(name, song) {
    super();
    this.name = name;
    this.song = song;
  }

  async open() {
    print(`Playing ${this.name}...`);
    print("Press any key to exit.");
    this.song.fastSeek(0);
    this.song.play();
    await pressAnyKey();
    this.song.pause();
  }
}

class TextFile extends Document {
  constructor(text) {
    super();
    this.text = text;
  }

  open() {
    print(this.text);
  }
}

const licenseText =
  "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
  "BY VIEWING THIS FILE YOU ARE COMMITING A FELONY UNDER\n" +
  "TITLE 2,239,132 SECTION XII OF THE PENGER CRIMINAL JUSTICE\nCODE";

const fileSystem = {
  pengos: {
    "LICENSE.TXT": new TextFile(licenseText),
  },
  software: {
    games: {
      pong: {
        "pong.exe": Program,
      },
    },
  },
  documents: {
    pengers: {
      "nerdger.png": new Image("NERDGER.PNG", "images/pengers/nerdger.png"),
      "macger.png": new Image("MACGER.PNG", "images/pengers/macger.png"),
    },
    music: {
      "canyon.mid": new AudioFile("CANYON.MID", canyonSong),
      "passport.mid": new AudioFile("PASSPORT.MID", passportSong),
      "king.mid": new AudioFile("KING.MID", kingSong),
    },
  },
  "date.exe": Program,
};

const commands = [
  function help() {
    const helpText = {
      help: "List available commands",
      look: "Display contents of current directory",
      go: "  Navigate directories",
      up: "  Navigate to parent directory",
      run: " Execute program",
      open: "Display file",
      take: "Add a program to the command list",
      drop: "Remove a program from the command list",
    };

    for (let command of commands) {
      if (helpText[command.name]) {
        print(command.name + "   " + helpText[command.name]);
      } else {
        print(command.name + ": HELP ENTRY NOT FOUND");
      }
    }

    if (extraCommands.length > 0) {
      print("");
      print("Available programs:");
      for (let command of extraCommands) {
        print(command);
      }
    }
  },

  function look() {
    let dir = path[path.length - 1];

    print("Currently in: " + pathNames.join("/"));
    print("");

    for (let name of Object.keys(dir)) {
      if (isDirectory(dir[name])) {
        print(name + "/");
      } else {
        print(name);
      }
    }
  },

  function go(name) {
    let dir = path[path.length - 1];
    let newDir = dir[name];

    if (!newDir) {
      print("Does not exist");
    } else if (!isDirectory(newDir)) {
      print("Not a directory");
    } else {
      path.push(newDir);
      pathNames.push(name);
    }

    print("Now in " + pathNames.join("/"));
  },

  function up() {
    if (path.length > 1) {
      path = path.slice(0, path.length - 1);
      pathNames = pathNames.slice(0, pathNames.length - 1);
    }

    print("Went up to " + pathNames.join("/"));
  },

  async function run(name) {
    let dir = path[path.length - 1];
    let program = dir[name];

    if (isProgram(program)) {
      return await programs[name.split(".")[0]]();
    } else if (program === undefined) {
      print("Does not exist");
    } else {
      print("Not executable");
    }
  },

  async function open(name) {
    let dir = path[path.length - 1];
    let file = dir[name];

    if (isFile(file)) {
      await file.open();
    } else if (file === undefined) {
      print("Does not exist");
    } else {
      print("Not readable");
    }
  },

  function take(name) {
    let dir = path[path.length - 1];
    let program = dir[name];

    if (isProgram(program)) {
      extraCommands.push(name.split(".")[0]);
      localStorage.setItem("pengos/programs", JSON.stringify(extraCommands));
      print("Added " + name.toUpperCase() + " to command list.");
    } else if (program === undefined) {
      print("Does not exist");
    } else {
      print("Not executable");
    }
  },

  function drop(name) {
    extraCommands = extraCommands.filter((x) => x != name);
    localStorage.setItem("pengos/programs", JSON.stringify(extraCommands));
  },
];

function pressAnyKey() {
  return new Promise((resolve, reject) => {
    let listener = function (event) {
      document.removeEventListener("keydown", listener);
      event.preventDefault();
      resolve();
    };
    document.addEventListener("keydown", listener);
  });
}

function isDirectory(thing) {
  return !isProgram(thing) && !isFile(thing);
}

function isProgram(thing) {
  return thing === Program;
}

function isFile(thing) {
  return thing instanceof Document;
}

let path = [fileSystem];
let pathNames = ["A:"];

let extraCommands = [];
{
  let storedCommands = localStorage.getItem("pengos/programs");
  if (storedCommands !== null) {
    extraCommands = JSON.parse(storedCommands);
  }
}

let print;

function tab(input) {
  let tokens = input.split(" ");
  if (!tokens) return "";
  let token = tokens[tokens.length - 1];

  let dir = path[path.length - 1];
  for (let name of Object.keys(dir)) {
    let prefix = name.slice(0, token.length);
    if (prefix === token) {
      return name.slice(token.length);
    }
  }

  return "";
}

async function submit(input, printFunction) {
  let tokens = input.split(" ");

  if (!tokens) return "";

  let command = tokens[0];
  let args = tokens.slice(1);

  print = printFunction;

  for (let f of commands) {
    if (f.name == command || command == f.name[0]) {
      await f(...args);
      return;
    }
  }

  if (extraCommands.includes(command)) {
    let f = programs[command];
    await f(...args);
    return;
  }

  print("Unknown command: " + command);
  print('Try "help" or "h" to see available commands');
}

// ====================== REAL

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
}

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

  private commandHelp() {
    const { screen } = this.pc;
    screen.printString("help      List available commands\n");
    screen.printString("look      Display contents of current directory\n");
    screen.printString("go        Navigate directories\n");
    screen.printString("up        Navigate to parent directory\n");
    screen.printString("makedir   Create a directory\n");
    screen.printString("prompt    Change your command prompt text\n");
  }

  async mainLoop() {
    const { screen, keyboard } = this.pc;

    const commands: Record<string, (args: string[]) => void> = {
      prompt: this.commandPrompt.bind(this),
      look: this.commandLook.bind(this),
      go: this.commandGo.bind(this),
      up: this.commandUp.bind(this),
      help: this.commandHelp.bind(this),
      h: this.commandHelp.bind(this),
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
  window.startupNoise.volume = 0.7;
  window.startupNoise.play();

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
