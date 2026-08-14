/**
 * Author: Strawberry / nashiora@github / echoephile@github
 * Description: Implements the h
 */

import {
    FilePath,
    FileType,
    FileMode,
    isDriveLetter,
    PATH_SEPARATOR,
    type DriveLetter,
} from "../FileSystem";
import { FileSystemDrive } from "../FileSystem/Drive";
import type { PC } from "./PC";

import { argparse } from "@Toolbox/argparse";
import { FileTransferManager } from "@Toolbox/FileTransferManager";

import { classicColors } from "@Color/ansi";

import _ from "lodash";
import type { Executable } from "@FileSystem/fileTypes";
import { applyFullScreenState } from "./util";
import { biosSettings } from "./BIOSSettings";

interface TakenProgram {
    path: FilePath;
    name: string;
}

export class PengerShell implements Executable {
    private pc: PC;

    private isRunning: boolean = false;

    private workingDirectories: Partial<Record<DriveLetter, FilePath>> = {};
    private currentDrive: DriveLetter = "C";
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

        this.takenPrograms = [];
        this.takeProgram("ped", FilePath.tryParse("C:/software/ped.exe")!);
        this.takeProgram("pwd", FilePath.tryParse("C:/test/pwd.exe")!);
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
        if(!wd.drive) throw new Error("workingDirectory set to non-abs path");
        const drive = wd.drive;
        this.currentDrive = drive;
        this.workingDirectories[drive] = wd;
        this.pc.std.setCwdP(wd);
    }

    private syncWorkingDirectoryFromStd() {
        const cwd = this.pc.std.getCwd();
        if (!cwd.drive || !this.pc.fileSystem.isMounted(cwd.drive)) return;

        const entry = this.pc.fileSystem.getFileInfo(cwd);
        if (!entry || entry.type !== FileType.Directory) return;

        this.currentDrive = cwd.drive;
        this.workingDirectories[cwd.drive] = cwd;
    }

    private shiftAutorunCommand() {
        const { std } = this.pc;
        if (this.autorun.length > 1) {
            const command = `go ${this.autorun.shift()}`;
            std.writeConsole(`${command}\n`);
            return command;
        }

        if (this.autorun.length === 1) {
            const command = `run ${this.autorun.shift()}`;
            std.writeConsole(`${command}\n`);
            return command;
        }

        return undefined;
    }

    async run(args: string[]) {
        const { std, fileSystem } = this.pc;
        let previousEntries: string[] = [];

        this.syncWorkingDirectoryFromStd();

        const commands: Record<
            string,
            (args: string[]) => void | Promise<void>
        > = {
            help: this.commandHelp.bind(this),
            h: this.commandHelp.bind(this),
            exit: this.commandExit.bind(this),
            history: (args) => this.commandHistory(args, previousEntries),
            look: this.commandLook.bind(this),
            go: this.commandGo.bind(this),
            up: this.commandUp.bind(this),
            makedir: this.commandMakeDir.bind(this),
            burndir: this.commandBurnDir.bind(this),
            run: this.commandRun.bind(this),
            open: this.commandOpen.bind(this),
            clear: this.commandClear.bind(this),
            zoom: this.commandZoom.bind(this),
            prompt: this.commandPrompt.bind(this),
            take: this.commandTake.bind(this),
            drop: this.commandDrop.bind(this),
            reboot: this.commandReboot.bind(this),
            disk: this.commandDisk.bind(this),
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
            let autoCompleteStrings = [
                ...this.takenPrograms.map((p) => p.name),
            ];

            const entry = fileSystem.getFileInfo(this.workingDirectory);
            if (entry && entry.type === FileType.Directory) {
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
                "zoom",
                "disk"
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
                const driveSwitchMatch = commandName.match(/^([A-Za-z]):$/);

                if (knownCommand) {
                    await knownCommand(args.slice(1));
                    std.resetConsole();
                } else if (knownTakenApp) {
                    const app = fileSystem.openFile(knownTakenApp.path);
                    if(!app || app.type != FileType.Executable) {
                        std.writeConsole("Executable not found. Consider dropping");
                        continue;
                    }
                    if(!app.execute) {
                        std.writeConsole(knownTakenApp.path.toString()+": Not allowed to execute");
                        continue;
                    }
                    await app.execute(args);
                    std.resetConsole();
                } else if (driveSwitchMatch) {
                    const drive = driveSwitchMatch[1].toUpperCase();
                    if (isDriveLetter(drive)) {
                        this.commandSwitchDrive(drive);
                    } else {
                        std.writeConsole(`Invalid drive label\n`);
                    }
                    std.resetConsole();
                } else {
                    std.writeConsole("Unknown command: " + commandName + "\n");
                    std.writeConsole(
                        'Try "help" or "h" to see available commands\n',
                    );
                    continue;
                }
                this.syncWorkingDirectoryFromStd();
            }
        }
    }

    printPrompt() {
        const { std } = this.pc;
        const { prompt } = this;

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
        const inputFilePath = FilePath.tryParse(
            inputPath ?? "",
            this.currentDrive,
        );
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

        let rows: string[][] = [];
        if (entry) {
            const driveFlags = fileSystem.getMountedDriveMode(lookPath.drive!);
            if (entry.type === FileType.Directory) {
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
                            a.type === FileType.Directory &&
                            b.type === FileType.Directory
                        ) {
                            return 0;
                        }
                        if (
                            a.type === FileType.Directory &&
                            b.type !== FileType.Directory
                        ) {
                            return -1;
                        }
                        return 1;
                    });
                    for (const ent of entries) {
                        const mode = ent.mode & driveFlags;
                        const isDir =
                            ent.type ===
                            FileType.Directory;
                        let size = 0;
                        if(isDir)
                          size = ent.entries.length;
                        else if(ent.type == FileType.TextFile)
                          size = ent.data.getText().length;
                        rows.push([
                            ((mode & FileMode.WRITE) ? 'w' : '-')
                            +((mode & FileMode.READ) ? 'r' : '-')
                            +((mode & FileMode.EXECUTE) ? 'x' : '-'),
                            String(size),
                            `${ent.name}${isDir ? PATH_SEPARATOR : ""}`,
                        ]);
                    }
                    std.writeConsoleAlignedRows(rows, 2, false);
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

        const newPath = this.getCanonicalPath(this.workingDirectory, dirName ?? "/");
        if (newPath === null) {
            if(!dirName) throw new Error("Disk root doesn't exist");
            std.writeConsole(`Can't find ${dirName}\n\n`);
            return;
        }

        const fsEntry = fileSystem.getFileInfo(newPath);
        if (fsEntry) {
            if (fsEntry.type === FileType.Directory) {
                this.workingDirectory = newPath;
                std.writeConsole(
                    `Now in ${this.workingDirectory.toString()}\n`,
                );
            } else {
                std.writeConsole("Not a directory\n");
            }
        } else {
            std.writeConsole("Does not exist\n");
        }
    }

    private commandSwitchDrive(letter: DriveLetter) {
        const { std, fileSystem } = this.pc;

        if (!fileSystem.isMounted(letter)) {
            std.writeConsole(`Drive ${letter}: is not available\n`);
            return;
        }

        const root = FilePath.tryParse("/", letter)!;
        const desiredWorkingDirectory =
            this.currentDrive === letter
                ? root
                : (this.workingDirectories[letter] ?? root);
        const actualWorkingDirectory = std.setCwdP(desiredWorkingDirectory);

        this.currentDrive = letter;
        if (actualWorkingDirectory.equals(desiredWorkingDirectory)) {
            this.workingDirectories[letter] = desiredWorkingDirectory;
        } else {
            this.workingDirectories[letter] = root;
            std.setCwdP(root);
        }
        std.writeConsole(`Now using ${this.workingDirectory.toString()}\n`);
    }

    private commandUp() {
        const { workingDirectory } = this;
        const { std } = this.pc;
        this.workingDirectory = workingDirectory.parentDirectory();
        if (
            workingDirectory.pieces.length !==
            this.workingDirectory.pieces.length
        ) {
            std.writeConsole(
                `Went up to ${this.workingDirectory.toString()}\n`,
            );
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
            const newDirPath = this.getCanonicalPath(
                this.workingDirectory,
                args[i],
            );
            if (newDirPath === null) {
                std.writeConsole(`Invalid path ${args[i]}\n`);
                continue;
            }

            try {
                fileSystem.createDirectory(newDirPath);
                std.writeConsole(
                    `Directory ${newDirPath.toString()} created\n`,
                );
            } catch (e) {
                std.writeConsole(`${(<Error>e).message}\n`);
                console.log(e);
            }
        }
    }

    private commandBurnDir(args: string[]) {
        const { fileSystem, std } = this.pc;
        if (args.length === 0) {
            std.writeConsole("Must provide a name\n");
        }

        for (let i = 0; i < args.length; i++) {
            const path = this.getCanonicalPath(this.workingDirectory, args[i]);
            if (path === null) {
                std.writeConsole(`Invalid path ${args[i]}\n`);
                continue;
            }

            try {
                fileSystem.removeDirectory(path, false);
                std.writeConsole(`Directory ${path.toString()} removed\n`);
            } catch (e) {
                std.writeConsole(`${(<Error>e).message}\n`);
            }
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

        const file = fileSystem.openFile(path);
        if (file) {
            const fileEntry = file.getEntry();
            if (file.type === FileType.Executable) {
                if (!file.execute) {
                    std.writeConsole(`${fileName}: Not allowed to execute\n`);
                    return;
                }
                await file.execute(args);
            } else if (
                fileEntry.type === FileType.Link &&
                fileEntry.openType == "run"
            ) {
                if (!file.execute) {
                    std.writeConsole(`${fileName}: Not allowed to execute\n`);
                    return;
                }
                std.writeConsole("Running...\n");
                await file.execute([]);
            } else {
                std.writeConsole(`Not executable\n`);
            }
        } else {
            std.writeConsole(`Does not exist\n`);
        }
    }

    private async commandOpen(args: string[]) {
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

        const file = fileSystem.openFile(path);
        if(!file) {
            std.writeConsole("Does not exist\n");
        } else {
            const fileEntry = file.getEntry();
            if (file.type === FileType.TextFile) {
                if (!file.read) {
                    std.writeConsole(`${path.toString()}: Not allowed to read\n`);
                    return;
                }
                std.writeConsole(file.read());
            } else if (fileEntry.type === FileType.Audio) {
                if (!file.execute) {
                    std.writeConsole(
                        `${path.toString()}: Not allowed to execute\n`,
                    );
                    return;
                }
                std.writeConsole(`Playing ${fileEntry.name}...\n`);
                std.writeConsole(`Press any key to exit.`);
                await file.execute(["play"]);
                await std.readConsoleKey();
                await file.execute(["stop"]);
                std.writeConsole(`\n`);
            } else if (fileEntry.type === FileType.Image) {
                if (!(file.mode & FileMode.READ)) {
                    std.writeConsole(`${path.toString()}: Not allowed to read\n`);
                    return;
                }
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
                fileEntry.type === FileType.Link &&
                fileEntry.openType == "open"
            ) {
                if (!file.execute) {
                    std.writeConsole(
                        `${path.toString()}: Not allowed to execute\n`,
                    );
                    return;
                }
                std.writeConsole("Opening...\n");
                await file.execute([]);
            } else {
                std.writeConsole(`Not readable\n`);
            }
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

    private takeProgram(name: string, path: FilePath): boolean {
        const { std, fileSystem: fs } = this.pc;
        const target = fs.openFile(path);
        if (!target) {
            std.writeConsole(path.toString()+": Not found\n");
            return false;
        }
        if (target.type !== FileType.Executable) {
            std.writeConsole(path.toString()+": Not executable\n");
            return false;
        }
        if(!target.execute) {
            std.writeConsole(path.toString()+": Not allowed to execute\n");
            return false;
        }

        this.takenPrograms.push({
            name, path
        });
        return true;
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
        const exeFullName = pieces[pieces.length - 1].trim().replace(" ", "-");
        let noExeName = exeFullName /* make sure to be respectful! */
            .split(".")
            .filter(n => !!n) /* remove empty string between dots e.g. test..exe */
            .slice(0, -1)
            .join('.');
        if(!noExeName) noExeName = exeFullName;
        let addName = noExeName;
        let dedupIndex = 0;
        while (this.takenPrograms.find((p) => p.name === addName)) {
            dedupIndex += 1;
            addName = `${noExeName}~${dedupIndex}`;
        }

        if(this.takeProgram(addName, path)) {
            std.writeConsole(`Added "${argsName}" as "${addName}" to command list\n`);
        }
    }

    private commandDrop(args: string[]) {
        const { std } = this.pc;

        if (args.length == 0) {
            std.writeConsole("Must provide at least one name\n");
            return;
        }

        let rmed: string[] = [];

        const newTakenPrograms = this.takenPrograms.filter(p => {
            if(args.includes(p.name)) {
                rmed.push(p.name);
                delete args[args.indexOf(p.name)];
                return false;
            }
            return true;
        });

        args = args.filter(x => x); /* delete does not actually delete */
        if(args.length) {
            console.log(args);
            std.writeConsole(args.join(', ') + " "
                + (args.length>1 ? "were" : "was") + " not found in the taken commands list.\n");
        }

        if(rmed.length) {
            std.writeConsole(rmed.join(', ') + " "+(rmed.length>1 ? "were" : "was")+" dropped.\n");
            this.takenPrograms = newTakenPrograms;
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
        printEntry("C: A:", "Switch to a mounted drive\n");
        printEntry("makedir", "Create a directory\n");
        printEntry("run", "Execute program\n");
        printEntry("open", "Display file\n");
        printEntry("clear", "Clear screen\n");
        printEntry("prompt", "Change your command prompt text\n");
        printEntry("take", "Add a program to the command list\n");
        printEntry("drop", "Remove a program from the command list\n");
        printEntry("disk", "Manage drives and floppy disks\n");
        printEntry("reboot", "Restart the system\n");
        printEntry("zoom", "Toggles the full screen mode on and off\n");

        if (this.takenPrograms.length > 0) {
            std.writeConsole("\nAvailable programs:\n");
            for (const takenProgram of this.takenPrograms) {
                std.writeConsole(`${takenProgram.name}\n`);
            }
        }
    }

    private commandDiskList() {
        const { std, fileSystem } = this.pc;

        let rows: string[][] = [];

        rows.push(["Letter", "Type", "Label", "Dirs", "Files", "Flags"]);

        for (const { letter, drive } of fileSystem.listAllDrives()) {
            const summary = fileSystem.summarizeDrive(drive)!;
            let flags = [];
            if(drive.readOnly) flags.push("ro");
            else flags.push("rw");
            if(drive.kind == "RAMFloppy") flags.push("ram");
            else if(drive.kind == "Fixed") flags.push("const");
            if(letter != null) {
                const mountMode = fileSystem.getMountedDriveMode(letter);
                if(!(mountMode & FileMode.WRITE)) {
                    const rw_at = flags.indexOf("rw");
                    if(rw_at != -1) {
                        flags[rw_at] = "ro";
                    }
                }
                flags.push("mount");
                if(!(mountMode & FileMode.EXECUTE)) {
                    flags[flags.indexOf("mount")] += "=noexec";
                }
            }
            let seenKind = drive.kind;
            if(seenKind == "RAMFloppy") seenKind = "Floppy";
            rows.push([
                letter==null ? "<none>" : letter+":",
                seenKind,
                drive.label,
                String(summary.directoryCount),
                String(summary.fileCount),
                flags.join(",")
            ]);
        }
        std.writeConsoleAlignedRows(rows);
    }

    private parseDiskLetter(input: string): DriveLetter | null {
        const match = /^([A-Za-z]):?$/.exec(input);
        if (!match) return null;

        const letter = match[1].toUpperCase();
        return isDriveLetter(letter) ? letter : null;
    }

    private async commandDisk(args: string[]) {
        const { std, fileSystem: fs } = this.pc;
        const [command] = args;


        if (command === "list") {
            this.commandDiskList();
        } else if (command === "spawn") {
            const [name] = args.slice(1);
            if(!name) {
                std.writeConsole("Not enough arguments to <");
                std.writeConsole("disk spawn <name>", { bold: true });
                std.writeConsole(">\n", { bold: false });
                return;
            }
            const label = name.toUpperCase();
            if(fs.driveExists(label)) {
                std.writeConsole("ERROR: A drive with this name already exists\n");
                return;
            }
            fs.registerDrive(new FileSystemDrive(false, label, "RAMFloppy"));

            std.writeConsole("Created a new disk labeled " + label + "\n");
        } else if(command === "insert") {
            const [u_letter, u_name] = args.slice(1);
            if(!u_letter || !u_name) {
                std.writeConsole("Missing arguments\n");
                return;
            }
            const name = u_name.toUpperCase();
            const disk = fs.getDriveByLabel(name);

            if(!disk) {
                std.writeConsole("Disk <" +name+ "> does not exist\n");
                return;
            }

            const letter = this.parseDiskLetter(u_letter);
            if (letter === null) {
                std.writeConsole("Invalid disk letter: '" + u_letter + "'\n");
                return;
            }

            if(fs.isMounted(letter)) {
                std.writeConsole("Drive " + letter + ": is already inserted\n");
                return;
            }
            if (!fs.mount(letter, name)) {
                std.writeConsole(`Could not insert disk <${name}>\n`);
                return;
            }
            delete this.workingDirectories[letter];
            std.writeConsole(`Installed drive <${name}> to ${letter}:\n`);
        } else if(command === "eject") {
            const [u_letter] = args.slice(1);
            if(!u_letter) {
                std.writeConsole("Missing drive letter to eject\n");
                return;
            }
            const letter = this.parseDiskLetter(u_letter);
            if (letter === null) {
                std.writeConsole("Invalid disk letter: '" + u_letter + "'\n");
                return;
            }

            if(!fs.isMounted(letter)) {
                std.writeConsole("Disk " + letter + ": is not inserted\n");
                return;
            }

            if(this.currentDrive == letter) {
                std.writeConsole("Cannot eject " +letter + ": because the shell workdir is inside it.\n");
                return;
            }

            if(fs.listMountedDrives().length == 1) {
                std.writeConsole("Cannot eject " +letter+ ": because it is the only inserted disk.\n");
                return;
            }

            fs.unmount(letter);
            delete this.workingDirectories[letter];
            std.writeConsole("Ejected " + letter + ":\n");
            return;
        } else if(command === "burn") {
            const [u_name] = args.slice(1);
            if(!u_name) {
                std.writeConsole("Need disk label to burn.\n");
                return;
            }
            const name = u_name.toUpperCase();
            const drive = fs.getDriveByLabel(name);
            if(!drive) {
                std.writeConsole("Drive <" +name+ "> does not exist.\n");
                return;
            }
            if(drive.kind == "Fixed") {
                std.writeConsole("Cannot destroy Fixed drive.\n");
                return;
            }
            if(fs.getMountpoints(name).length) {
                std.writeConsole("Cannot destroy inserted drive <"+name+">.\n");
                return;
            }
            fs.unregisterDrive(drive.label);
            std.writeConsole("Burned, destroyed and trashed <"+drive.label+">\n");
        } else if(command === "export") {
            const [ident] = args.slice(1);
            if(!ident) {
                std.writeConsole("Provide a disk label to export\n");
                return;
            }
            const label = ident.toUpperCase();
            if(!fs.getDriveByLabel(label)) {
                std.writeConsole("Disk " +label+ " does not exist\n");
                return;
            }

            const blob = await fs.exportFS(label);
            if(!blob) {
                std.writeConsole("Something went wrong\n");
                return;
            }
            std.writeConsole(blob+"\n");
            std.writeConsole("Downloading...\n");
            await FileTransferManager.presentDownload(blob, label+".pfs", "application/pengerfs");
        } else if(command === "import") {
            std.writeConsole("Prompting upload...\n");
            var pengfs: string;
            try {
                const { name, text: contents } = await FileTransferManager.askForUpload("pfs", "application/pengerfs");
                pengfs = contents;
            } catch (e) {
                std.writeConsole("Upload cancelled.\n");
                console.log(e);
                return;
            }
            try {
                const ret = await fs.importFS(pengfs);
                std.writeConsole("Successfully imported drive " +ret+ "\n");
            } catch(e) {
                std.writeConsole("FS import failed\n");
                std.writeConsole("Error: " + (<Error>e).message + "\n");
                return;
            }
        } else {
            const printEntry = (cmd: string, text: string) => {
                const cmdFmt =
                    cmd.length < 10
                        ? _.padEnd(cmd, 10) + " "
                        : cmd + "\n           ";
                std.writeConsoleSequence([
                    { bold: true },
                    cmdFmt,
                    { reset: true },
                    text,
                ]);
            };

            if (!command) {
                std.writeConsole(`Missing a command\n\n`);
            } else if (command !== "help") {
                std.writeConsole(`Unknown disk command "${command}"\n\n`);
            }

            printEntry("disk list", "List all drives and floppies\n");
            printEntry("disk spawn <name>", "Create a blank floppy '<name>'\n");
            printEntry(
                "disk import <name>",
                "Import data onto floppy '<name>'\n",
            );
            printEntry(
                "disk export <name>",
                "Export data off of floppy '<name>'\n",
            );
            printEntry(
                "disk burn <name>",
                "Completely destroy floppy '<name>'\n",
            );
            printEntry(
                "disk insert <letter> <name>",
                "Insert floppy '<name>' into drive <letter>\n",
            );
            printEntry(
                "disk eject <letter>",
                "Eject the floppy at drive <letter>\n",
            );
        }
    }

    private commandZoom() {
        biosSettings.setSetting("zoom", !biosSettings.getSetting("zoom"));
        applyFullScreenState();
    }
}
