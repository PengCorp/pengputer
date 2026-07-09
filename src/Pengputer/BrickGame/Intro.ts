/* Port of Games/Intro - the attract-mode animation shown before the menu. */

import { type DeviceEvent, TickTimer, v } from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { MainMenu } from "./MainMenu";

const INTRO_WIDTH = 10;
const INTRO_HEIGHT = 20;

// prettier-ignore
const INTRO_PATTERN_B =
    " ***      " +
    " * *      " +
    " *** ***  " +
    "   * * *  " +
    " *** ***  " +
    "       *  " +
    "     ***  " +
    " ***      " +
    " * *      " +
    " *** ***  " +
    "   * * *  " +
    " *** ***  " +
    "       *  " +
    "     ***  " +
    "          " +
    "* *  *  * " +
    "* ** * ** " +
    "* * **  * " +
    "* *  *  * " +
    "       ***";

enum InverterDir {
    Up,
    Down,
    Left,
    Right,
}

/** Port of Games/Intro/IntroInverter.gd. */
class IntroInverter extends GameState {
    private intro: Intro;
    private fill: string[];
    private inverterTimer = new TickTimer(1);
    private inverterDir = InverterDir.Up;
    private inverterPos = v(9, 19);
    private inverterCount = 0;
    private inverterReversing = false;

    constructor(root: GameRoot, intro: Intro) {
        super(root);
        this.intro = intro;
        this.fill = new Array(INTRO_WIDTH * INTRO_HEIGHT).fill(" ");
        this.inverterTimer.onTriggered = () => this.inverterTick();
    }

    private fillAt(x: number, y: number): string {
        return this.fill[y * INTRO_WIDTH + x];
    }

    private inverterTick() {
        const inverterChar = this.inverterReversing ? " " : "*";
        this.fill[this.inverterPos.y * INTRO_WIDTH + this.inverterPos.x] =
            inverterChar;
        this.inverterCount += 1;
        if (this.inverterCount === INTRO_WIDTH * INTRO_HEIGHT) {
            this.inverterReversing = !this.inverterReversing;
            this.inverterCount = 0;
            this.inverterPos = v(0, 0);
            this.inverterDir = InverterDir.Down;
            this.intro.switchTo("blink");
            return;
        }
        switch (this.inverterDir) {
            case InverterDir.Up:
                if (
                    this.inverterPos.y === 0 ||
                    this.fillAt(this.inverterPos.x, this.inverterPos.y - 1) ===
                        inverterChar
                ) {
                    this.inverterDir = InverterDir.Left;
                    this.inverterPos.x -= 1;
                } else {
                    this.inverterPos.y -= 1;
                }
                break;
            case InverterDir.Down:
                if (
                    this.inverterPos.y === INTRO_HEIGHT - 1 ||
                    this.fillAt(this.inverterPos.x, this.inverterPos.y + 1) ===
                        inverterChar
                ) {
                    this.inverterDir = InverterDir.Right;
                    this.inverterPos.x += 1;
                } else {
                    this.inverterPos.y += 1;
                }
                break;
            case InverterDir.Left:
                if (
                    this.inverterPos.x === 0 ||
                    this.fillAt(this.inverterPos.x - 1, this.inverterPos.y) ===
                        inverterChar
                ) {
                    this.inverterDir = InverterDir.Down;
                    this.inverterPos.y += 1;
                } else {
                    this.inverterPos.x -= 1;
                }
                break;
            case InverterDir.Right:
                if (
                    this.inverterPos.x === INTRO_WIDTH - 1 ||
                    this.fillAt(this.inverterPos.x + 1, this.inverterPos.y) ===
                        inverterChar
                ) {
                    this.inverterDir = InverterDir.Up;
                    this.inverterPos.y -= 1;
                } else {
                    this.inverterPos.x += 1;
                }
                break;
        }
    }

    override bgRender() {
        for (let y = 0; y < INTRO_HEIGHT; y += 1) {
            for (let x = 0; x < INTRO_WIDTH; x += 1) {
                let isMarked = this.intro.pattern[y * INTRO_WIDTH + x] === "*";
                const inverted = this.fillAt(x, y) === "*";
                if (inverted) isMarked = !isMarked;
                this.device.mainScreen.setPixel(x, y, isMarked);
            }
        }
    }

    override bgTick() {
        this.inverterTimer.tick();
    }

    override bgInput(event: DeviceEvent) {
        if (event.pressed && event.key === "start") {
            this.root.popState();
        }
    }
}

/** Port of Games/Intro/IntroBlink.gd. */
class IntroBlink extends GameState {
    private intro: Intro;
    private blinkTicks = 0;
    private blinkInverted = true;

    constructor(root: GameRoot, intro: Intro) {
        super(root);
        this.intro = intro;
    }

    private drawFull(x: number, y: number) {
        const drawPattern = Math.floor(this.blinkTicks / 20) % 2 === 0;
        const patternChar = this.intro.pattern[y * INTRO_WIDTH + x];
        let shouldDraw: boolean;
        if (this.blinkInverted) {
            shouldDraw = drawPattern ? patternChar === " " : true;
        } else {
            shouldDraw = drawPattern ? patternChar === "*" : false;
        }
        this.device.mainScreen.setPixel(x, y, shouldDraw);
    }

    override bgTick() {
        this.blinkTicks += 1;
        if (this.blinkTicks === 20 * 2 * 4) {
            this.blinkTicks = 0;
            this.blinkInverted = !this.blinkInverted;
            this.intro.switchTo("inverter");
        }
    }

    override bgRender() {
        this.device.mainScreen.clear();
        for (let y = 0; y < INTRO_HEIGHT; y += 1) {
            for (let x = 0; x < INTRO_WIDTH; x += 1) {
                this.drawFull(x, y);
            }
        }
    }

    override bgInput(event: DeviceEvent) {
        if (event.pressed && event.key === "start") {
            this.root.popState();
        }
    }
}

/** Port of Games/Intro/Intro.gd. */
export class Intro extends GameState {
    public readonly pattern = INTRO_PATTERN_B;
    private introInverter: IntroInverter;
    private introBlink: IntroBlink;

    constructor(root: GameRoot) {
        super(root);
        this.introInverter = new IntroInverter(root, this);
        this.introBlink = new IntroBlink(root, this);
    }

    public switchTo(newStateKey: "inverter" | "blink") {
        const newState =
            newStateKey === "inverter" ? this.introInverter : this.introBlink;
        this.root.replaceState(newState);
    }

    override bgEnter() {
        this.root.pushState(this.introInverter);
        this.device.scoreDisplay.clearDigits();
    }

    override bgFocus() {
        this.root.replaceState(new MainMenu(this.root));
    }
}
