import { padStart } from "lodash";
import { Keyboard, PhysicalKeyboard, ScreenKeyboard } from "../Keyboard";
import { Screen } from "../Screen";
import { loadImageBitmapFromUrl } from "@Toolbox/loadImage";
import { waitFor } from "@Toolbox/waitFor";
import { DateApp } from "./DateApp";
import { EightBall } from "./EightBall";
import {
    FileEntryDirectory,
    FilePath,
    FileSystem,
    FileType,
} from "../FileSystem";
import { HelloWorld } from "./HelloWorld";
import { type PC } from "./PC";
import { PengerShell } from "./PengerShell";

import biosPenger from "./res/biosPenger.png";
import energyStar from "./res/energyStar.png";

import { ScreenMode, Std } from "../Std";
import canyonOgg from "./files/documents/music/CANYON.ogg";
import mountainKingOgg from "./files/documents/music/mountainking.ogg"; // cspell:disable-line
import passportOgg from "./files/documents/music/PASSPORT.ogg";
import macgerPng from "./files/documents/pengers/macger.png";
import nerdgerPng from "./files/documents/pengers/nerdger.png";
import {
    AudioFile,
    ImageFile,
    LinkFile,
    TextFile,
} from "@FileSystem/fileTypes";
import { PengsweeperApp } from "./Pengsweeper";
import { PrintArgs } from "./PrintArgs";
import { TetrisApp } from "./Tetris";

import "@Color/ansi";
import { TextBuffer } from "../TextBuffer";
import { Blackjack } from "./Blackjack";
import { Colors } from "./Colors";
import { FileTransferTest } from "./FileTransferTest";
import { TestPwd } from "./testexe/pwd";
import { Pedlin } from "./Pedlin";
import { EdApp } from "./ed";
import { runAnimationLoop } from "@Toolbox/AnimationLoop";

import { vga9x16, loadFonts } from "../Screen/Fonts";
import { applyFullScreenState } from "./util";
import { BIOS } from "./BIOS";
import { biosSettings } from "./BIOSSettings";

const PATH_SEPARATOR = "/";

declare global {
    interface Window {
        startupNoise: HTMLAudioElement;
    }
}

class PengOS {
    private pc: PC;

    constructor(keyboard: Keyboard, textBuffer: TextBuffer, screen: Screen) {
        const fileSystem = new FileSystem();
        const std = new Std(keyboard, textBuffer, screen, fileSystem);
        std.setConsoleScreenMode(ScreenMode.mode80x25);
        this.pc = {
            std,
            fileSystem,
            keyboard,
            reboot: async () => {
                localStorage.removeItem("hasStartedUp");
            },
        };
    }

    private async runShell() {
        const { std } = this.pc;
        const pengerShellExe = this.pc.fileSystem.getFileInfo(
            FilePath.tryParse("C:/software/psh.exe"),
        );
        if (
            pengerShellExe !== null &&
            pengerShellExe.type === FileType.Executable
        ) {
            await pengerShellExe.createInstance().run([]);
        } else {
            throw new Error(
                "Missing default PengerShell executable at 'C:/software/psh.exe'.",
            );
        }
        std.clearConsole();
    }

    async startup() {
        const rootDir = this.pc.fileSystem.getFileInfo(
            FilePath.tryParse("C:/"),
        )! as FileEntryDirectory;
        if (!rootDir) {
            throw new Error("Root dir is undefined.");
        }

        rootDir.addItem({
            type: FileType.Executable,
            name: "date.exe",
            createInstance: () => new DateApp(this.pc),
        });

        const pengOSDir = rootDir.mkdir("pengos"); // cspell:disable-line
        const licenseTxt = new TextFile();
        licenseTxt.replace(
            "(C) COPYRIGHT 1985 PENGER CORPORATION (PENGCORP)\n\n" +
                "BY VIEWING THIS FILE YOU ARE COMMITTING A FELONY UNDER TITLE 2,239,132 SECTION\n" +
                "XII OF THE PENGER CRIMINAL JUSTICE CODE",
        );
        pengOSDir.addItem({
            type: FileType.TextFile,
            data: licenseTxt,
            name: "LICENSE.TXT",
        });
        const pplTxt = new TextFile();
        pplTxt.replace(
            `Penger Public License (PPL)\n\nNo copyright.\nIf you are having fun, you are allowed to use and distribute whatever you want.\nYou can't forbid anyone to use Penger freely.\nNo requirements.`,
        );
        pengOSDir.addItem({
            type: FileType.TextFile,
            data: pplTxt,
            name: "PPL.TXT",
        });

        const testDir = rootDir.mkdir("test");
        testDir.addItem({
            type: FileType.Executable,
            name: "colors.exe",
            createInstance: () => new Colors(this.pc),
        });
        testDir.addItem({
            type: FileType.Executable,
            name: "args.exe",
            createInstance: () => new PrintArgs(this.pc),
        });
        testDir.addItem({
            type: FileType.Executable,
            name: "hello.exe",
            createInstance: () => new HelloWorld(this.pc),
        });
        testDir.addItem({
            type: FileType.Executable,
            name: "transfer.exe",
            createInstance: () => new FileTransferTest(this.pc),
        });
        testDir.addItem({
            type: FileType.Executable,
            name: "pwd.exe",
            createInstance: () => new TestPwd(this.pc),
        });

        const softwareDir = rootDir.mkdir("software");

        softwareDir.addItem({
            type: FileType.Executable,
            name: "8ball.exe",
            createInstance: () => new EightBall(this.pc),
        });
        softwareDir.addItem({
            type: FileType.Executable,
            name: "psh.exe",
            createInstance: () => new PengerShell(this.pc),
        });
        softwareDir.addItem({
            type: FileType.Executable,
            name: "pedlin.exe",
            createInstance: () => new Pedlin(this.pc),
        });
        softwareDir.addItem({
            type: FileType.Executable,
            name: "ped.exe",
            createInstance: () => new EdApp(this.pc)
        });

        const gamesDir = rootDir.mkdir("games");
        gamesDir.addItem({
            type: FileType.Link,
            name: "pongr.exe", // cspell:disable-line
            data: new LinkFile("https://penger.city/pongerslair/"),
            openType: "run",
        });
        gamesDir.addItem({
            type: FileType.Executable,
            name: "pengtris.exe", // cspell:disable-line
            createInstance: () => new TetrisApp(this.pc),
        });
        gamesDir.addItem({
            type: FileType.Executable,
            name: "pengswp.exe", // cspell:disable-line
            createInstance: () => new PengsweeperApp(this.pc),
        });
        gamesDir.addItem({
            type: FileType.Executable,
            name: "blakjack.exe", // cspell:disable-line
            createInstance: () => new Blackjack(this.pc),
        });

        const documentsDir = rootDir.mkdir("documents");
        const musicDir = documentsDir.mkdir("music");
        musicDir.addItem({
            type: FileType.Audio,
            name: "CANYON.MID",
            data: new AudioFile(canyonOgg),
        });
        musicDir.addItem({
            type: FileType.Audio,
            name: "PASSPORT.MID",
            data: new AudioFile(passportOgg),
        });
        musicDir.addItem({
            type: FileType.Audio,
            name: "mountainking.mid", // cspell:disable-line
            data: new AudioFile(mountainKingOgg),
        });

        const pengersDir = documentsDir.mkdir("pengers");
        pengersDir.addItem({
            type: FileType.Image,
            name: "macger.png", // cspell:disable-line
            data: new ImageFile(macgerPng), // cspell:disable-line
        });
        pengersDir.addItem({
            type: FileType.Image,
            name: "nerdger.png", // cspell:disable-line
            data: new ImageFile(nerdgerPng), // cspell:disable-line
        });

        await this.runStartupAnimation();
        do {
            const { std } = this.pc;

            try {
                await this.runShell();
                await this.runStartupAnimation();
            } catch (e) {
                std.writeConsoleError(e);
                console.error(e);
            }
        } while (true);
    }

    private async runStartupAnimation() {
        const { std, keyboard } = this.pc;

        std.resetConsole();
        let hasStartedUp = Boolean(localStorage.getItem("hasStartedUp"));

        // if(hasStartedUp) return;

        if(import.meta.env.DEV) {
            let y = 0;

            std.setConsoleScreenMode(ScreenMode.mode80x25);

            std.setConsoleCursorPosition({ x: 0, y });
            std.writeConsole("[i] You are a dev; fast-forwarding boot sequence.");
            y = 2;
            std.setConsoleCursorPosition({ x: 2, y });
            std.writeConsole("Press ");
            std.writeConsole("DEL", {bold: true});
            std.writeConsole(" to enter BIOS.", {bold: false});
            y++;
            std.setConsoleCursorPosition({ x: 2, y });
            std.writeConsole("Press any key to skip.");

            y += 2;

            const FFbootDelay = 3;
            let goBios = false;
            await runAnimationLoop((_, tt) => {
                std.setConsoleCursorPosition({ x: 0, y });
                std.writeConsole((FFbootDelay - Math.floor(tt/1000)) + "s to boot");
                const kbe = keyboard.getNextEvent();
                if(kbe) {
                    if(!kbe.pressed) return false;
                    if(kbe.code == "Delete") {
                        goBios = true;
                        return true;
                    }
                    if(!kbe.isModifier && !kbe.isAutoRepeat) return true;
                }

                return tt >= FFbootDelay*1000;
            });
            std.setConsoleCursorPosition({ x: 0, y: 5 });
            std.writeConsole("                        ");
            std.setConsoleCursorPosition({ x: 0, y: 5 });
            if(goBios) {
                await new BIOS(this.pc).run([]);
                std.resetConsole();
                std.setConsoleScreenMode(ScreenMode.mode80x25);
            }
            localStorage.setItem("hasStartedUp", "yes");
            return;
        }

        while (!hasStartedUp) {
            std.setConsoleScreenMode(ScreenMode.mode80x25);

            let deletePressed = false;
            const unsubDelete = keyboard.subscribe((data) => {
                if (data.code === "Delete") {
                    deletePressed = true;
                    const attrs = std.getConsoleAttributes();
                    const pos = std.getConsoleCursorPosition();
                    std.setConsoleCursorPosition({ x: 0, y: 23 });
                    std.resetConsoleAttributes();
                    std.writeConsole("Entering ");
                    std.writeConsole("SETUP", { bold: true });
                    std.writeConsole("...       ", { reset: true });
                    std.setConsoleAttributes(attrs);
                    std.setConsoleCursorPosition(pos);
                }
            });
            window.startupNoise.volume = 0.7;
            window.startupNoise.play();

            std.resetConsole();
            std.clearConsole();
            std.setIsConsoleCursorVisible(false);
            std.drawConsoleImage(
                await loadImageBitmapFromUrl(energyStar),
                -135,
                0,
            );

            std.writeConsole(
                "    Penger Modular BIOS v5.22, An Energy Star Ally\n",
            );
            std.writeConsole("    Copyright (C) 1982-85, PengCorp\n");
            std.writeConsole("\n");
            std.drawConsoleImage(
                await loadImageBitmapFromUrl(biosPenger),
                0,
                0,
            );

            const curPos = std.getConsoleCursorPosition();
            std.setConsoleCursorPosition({ x: 0, y: 23 });
            std.writeConsole("Press ");
            std.updateConsoleAttributes({ bold: true });
            std.writeConsole("DEL");
            std.resetConsoleAttributes();
            std.writeConsole(" to enter SETUP\n");
            std.writeConsole("05/02/1984-ALADDIN5-P2B-6733F1-9268");
            std.setConsoleCursorPosition(curPos);
            await waitFor(1000);

            std.writeConsole("AMD-K6(rm)-III/450 Processor\n");
            std.writeConsole("Memory Test :        ");
            await waitFor(500);

            const totalMem = 262144;
            await runAnimationLoop((dt, tt) => {
                const mem = Math.round(totalMem * (Math.min(tt, 2500) / 2500));
                std.moveConsoleCursorBy({ x: -7, y: 0 });
                std.writeConsole(`${padStart(String(mem), 6, " ")}K`);
                return mem === totalMem;
            });
            await waitFor(500);

            std.writeConsole(` OK\n`);
            std.writeConsole("\n");
            await waitFor(750);

            std.writeConsole("Initialize Plug and Play Cards...\n");
            await waitFor(1000);

            std.writeConsole("PNP Init Completed");
            await waitFor(2500);

            unsubDelete();

            if (deletePressed) {
                console.log("go to BIOS");
                await new BIOS(this.pc).run([]);
                continue;
            }

            std.clearConsole();
            std.writeConsole(
                "╔═══════════════════════════════════════════════════════════════════════════╗\n",
            );
            std.writeConsole(
                "║            PBIOS System Configuration (C) 1982-1985, PengCorp             ║\n",
            );
            std.writeConsole(
                "╠═════════════════════════════════════╤═════════════════════════════════════╣\n",
            );
            std.writeConsole(
                "║ Main Processor     : AMD-K6-III     │ Base Memory Size   : 640 KB         ║\n",
            );
            std.writeConsole(
                "║ Numeric Processor  : Present        │ Ext. Memory Size   : 261504 KB      ║\n",
            );
            std.writeConsole(
                "║ Floppy Drive A:    : None           │ Hard Disk C: Type  : 47             ║\n",
            ); // 1.44 MB, 3½"
            std.writeConsole(
                "║ Floppy Drive B:    : None           │ Hard Disk D: Type  : None           ║\n",
            );
            std.writeConsole(
                "║ Display Type       : VGA/PGA/EGA    │ Serial Port(s)     : 3F8, 2F8       ║\n",
            );
            std.writeConsole(
                "║ PBIOS Date         : 11/11/85       │ Parallel Port(s)   : 378            ║\n",
            );
            std.writeConsole(
                "╚═════════════════════════════════════╧═════════════════════════════════════╝\n",
            );
            await waitFor(1500);
            std.writeConsole("Starting PengOS...\n\n");
            await waitFor(1000);
            localStorage.setItem("hasStartedUp", "yes");
            hasStartedUp = true;
        }
    }
}

(async () => {
    biosSettings.init();

    await loadFonts();

    const screen = new Screen({ w: 80, h: 25 }, vga9x16);
    await screen.init(document.getElementById("screen-container")!);

    const keyboard = new Keyboard();
    const physicalKeyboard = new PhysicalKeyboard(keyboard);
    const screenKeyboard = new ScreenKeyboard(keyboard);
    keyboard.addSource(physicalKeyboard);
    keyboard.addSource(screenKeyboard);

    const textBuffer = new TextBuffer({
        pageSize: screen.getSizeInCharacters(),
        scrollbackLength: 0,
    });

    let lastTime = performance.now();

    window.timeSamples = [];

    const cb = () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();
        const start = performance.now();

        screen.update(textBuffer);
        screen.draw(dt);

        const end = performance.now();

        window.timeSamples = window.timeSamples ?? [];
        window.timeSamples.push(end - start);
        while (window.timeSamples.length > 60) {
            window.timeSamples.shift();
        }
        window.avg =
            window.timeSamples.reduce((acc, v) => acc + v, 0) /
            window.timeSamples.length;

        keyboard.update(dt);
        requestAnimationFrame(cb);
    };
    requestAnimationFrame(cb);

    applyFullScreenState();

    const pengOS = new PengOS(keyboard, textBuffer, screen);
    await pengOS.startup();
})();
