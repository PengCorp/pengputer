/*
 * BrickGame 9999 - a faithful port of the Godot "BrickGame" clone
 * (ref/BrickGame-main) to the Pengputer terminal.
 *
 * The original is the classic "9999-in-1" LCD handheld: a 10x20 pixel main
 * screen, a small hint screen used for lives, and a set of segment number
 * displays. Games are GameStates managed on a stack by a GameRoot, and the
 * whole device runs on a fixed 60Hz tick.
 *
 * Rather than the (half baked) graphics mode, this uses terminal text
 * graphics: each LCD pixel is rendered as two character cells, giving the
 * familiar green-LCD look. This file is the "main system" - the device boot,
 * the fixed-tick loop and the keyboard mapping; the games live in their own
 * files (Intro/MainMenu/Snake/Frogger/Arkanoid).
 */

import { classicColors } from "@Color/ansi";
import { type Executable } from "@FileSystem/fileTypes";
import { runAnimationLoop } from "@Toolbox/AnimationLoop";
import { type PC } from "../PC";
import { type Std } from "../../Std";
import { type DeviceKey } from "./core";
import { Device } from "./Device";
import { GameRoot } from "./GameRoot";
import { Intro } from "./Intro";

const TICKS_PER_SECOND = 60;
const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
const MAX_TICKS_PER_FRAME = 5;

function mapKeyToDevice(code: string): DeviceKey | null {
    switch (code) {
        case "ArrowUp":
            return "up";
        case "ArrowDown":
            return "down";
        case "ArrowLeft":
            return "left";
        case "ArrowRight":
            return "right";
        case "Space":
        case "KeyZ":
            return "fire";
        case "KeyX":
            return "fire2";
        case "Enter":
        case "NumpadEnter":
            return "start";
        case "KeyP":
            return "pause";
        case "KeyR":
            return "reset";
        case "Escape":
            return "exit";
        default:
            return null;
    }
}

export class BrickGameApp implements Executable {
    private pc: PC;
    private std: Std;
    private device: Device;
    private root: GameRoot;
    private accumulator = 0;

    constructor(pc: PC) {
        this.pc = pc;
        this.std = pc.std;
        this.device = new Device();
        this.root = new GameRoot(this.device);
    }

    private doInput() {
        const { std, root } = this;
        while (true) {
            const ev = std.getNextKeyboardEvent();
            if (!ev) break;
            if (ev.isAutoRepeat) continue;
            const key = mapKeyToDevice(ev.code);
            if (!key) continue;
            root.bgInput({ type: "key", pressed: ev.pressed, key });
        }
    }

    async run(_args: string[]) {
        const { std, root, device } = this;

        std.flushKeyboardEvents();
        std.setIsConsoleCursorVisible(false);

        const currentAttributes = std.getConsoleAttributes();
        currentAttributes.bgColor = classicColors["black"];
        currentAttributes.fgColor = classicColors["lightGray"];
        std.setConsoleAttributes(currentAttributes);
        std.clearConsole();
        device.drawChrome(std);

        root.pushState(new Intro(root));

        await runAnimationLoop((dt) => {
            this.doInput();

            if (root.size() === 0) return true;

            this.accumulator += dt;
            if (this.accumulator > MS_PER_TICK * MAX_TICKS_PER_FRAME) {
                this.accumulator = MS_PER_TICK * MAX_TICKS_PER_FRAME;
            }
            let ticked = 0;
            while (
                this.accumulator >= MS_PER_TICK &&
                ticked < MAX_TICKS_PER_FRAME &&
                root.size() > 0
            ) {
                root.bgTick();
                this.accumulator -= MS_PER_TICK;
                ticked += 1;
            }

            if (root.size() === 0) return true;

            root.bgRender();
            device.draw(std);

            return root.size() === 0;
        });

        std.clearConsole();
        std.writeConsole("Thank you for playing!\n", { reset: true });
    }
}
