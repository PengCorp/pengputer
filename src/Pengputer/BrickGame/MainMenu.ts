/* Port of Games/MainMenu. */

import _ from "lodash";
import { type DeviceEvent, PixelArray, v } from "./core";
import { TickTimer } from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { Snake } from "./Snake";
import { Frogger } from "./Frogger";
import { Arkanoid } from "./Arkanoid";

// prettier-ignore
const LETTER_GRAPHICS: Record<string, string> = {
    A: " *** *   *******   **   *",
    B: "**** *   *******   ***** ",
    C: " *****    *    *     ****",
    D: "****  *  * *  * *  ***** ",
    E: "******    ******    *****",
    F: "******    ******    *    ",
    G: " *** *    * ****   * *** ",
    H: "*   **   *******   **   *",
    I: "*****  *    *    *  *****",
    J: "*****    *    **   * *** ",
    K: "*   **  * ***  *  * *   *",
    L: "*    *    *    *    *****",
    M: "*   *** *** * **   **   *",
    N: "*   ***  ** * **  ***   *",
    O: " *** *   **   **   * *** ",
    P: "**** *   ***** *    *    ",
    Q: " *** *   ** * **  ** ****",
    R: "**** *   ***** *   **   *",
    S: " *****     ***     ***** ",
    T: "*****  *    *    *    *  ",
    U: "*   **   **   **   * *** ",
    V: "*   **   **   * * *   *  ",
    W: "*   **   ** * ** * * * * ",
    X: "*   * * *   *   * * *   *",
    Y: "*   * * *   *    *    *  ",
    Z: "*****   *   *   *   *****",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const LETTER_POS = v(2, 1);
const LETTER_SIZE = v(5, 5);

// prettier-ignore
const LETTER_ANIM_FRAMES: number[][] = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, -1],
    [2, 1, 0, -1, -2],
    [3, 2, 0, -2, -3],
    [4, 2, 0, -2, -4],
    [3, 2, 0, -2, -3],
    [2, 1, 0, -1, -2],
    [1, 0, 0, 0, -1],
];

/** Port of Games/MainMenu/MainMenuLetter.gd. */
class MainMenuLetter {
    private currentLetterI = 0;
    private letterAnimTimer = new TickTimer(7);
    private letterAnimFrameI = 0;

    constructor() {
        this.letterAnimTimer.onTriggered = () => {
            this.letterAnimFrameI += 1;
            if (this.letterAnimFrameI >= LETTER_ANIM_FRAMES.length) {
                this.letterAnimFrameI = 0;
            }
        };
    }

    public tick() {
        this.letterAnimTimer.tick();
    }

    public render(mainScreen: PixelArray) {
        const animFrame = LETTER_ANIM_FRAMES[this.letterAnimFrameI];
        const graphic = LETTER_GRAPHICS[LETTERS[this.currentLetterI]];
        for (let r = 0; r < LETTER_SIZE.y; r += 1) {
            for (let c = 0; c < LETTER_SIZE.x; c += 1) {
                const isOn = graphic[r * LETTER_SIZE.x + c] === "*";
                if (isOn) {
                    mainScreen.setPixel(
                        c + animFrame[c] + LETTER_POS.x,
                        r + LETTER_POS.y,
                        true,
                    );
                }
            }
        }
    }

    public getCurrent(): string {
        return LETTERS[this.currentLetterI];
    }

    public nextLetter() {
        this.currentLetterI += 1;
        if (this.currentLetterI >= LETTERS.length) this.currentLetterI = 0;
        this.letterAnimFrameI = 0;
    }

    public prevLetter() {
        this.currentLetterI -= 1;
        if (this.currentLetterI < 0) this.currentLetterI = LETTERS.length - 1;
        this.letterAnimFrameI = 0;
    }

    public resetAnim() {
        this.letterAnimFrameI = 0;
    }
}

// prettier-ignore
const NUM_GRAPHICS: Record<string, string> = {
    "0": "**** ** ** ****",
    "1": " * **  *  * ***",
    "2": "***  *****  ***",
    "3": "***  ****  ****",
    "4": "* ** ****  *  *",
    "5": "****  ***  ****",
    "6": "****  **** ****",
    "7": "***  *  *  *  *",
    "8": "**** ***** ****",
    "9": "**** ****  ****",
};

const NUM_SIZE = v(3, 5);
const NUM_POS = v(2, 14);

/** Port of Games/MainMenu/MainMenuNumber.gd. */
class MainMenuNumber {
    public currentNum = 1;

    public render(mainScreen: PixelArray) {
        const digits = _.padStart(String(this.currentNum), 2, "0");
        for (let digitI = 0; digitI < digits.length; digitI += 1) {
            const digit = digits[digitI];
            const graphic = NUM_GRAPHICS[digit];
            for (let r = 0; r < NUM_SIZE.y; r += 1) {
                for (let c = 0; c < NUM_SIZE.x; c += 1) {
                    const isOn = graphic[r * NUM_SIZE.x + c] === "*";
                    mainScreen.setPixel(
                        c + NUM_POS.x + digitI * (NUM_SIZE.x + 1),
                        r + NUM_POS.y,
                        isOn,
                    );
                }
            }
        }
    }

    // Note: original has next/prev swapped (next decrements). Kept faithful.
    public nextNumber() {
        this.currentNum -= 1;
        if (this.currentNum < 1) this.currentNum = 99;
    }

    public prevNumber() {
        this.currentNum += 1;
        if (this.currentNum > 99) this.currentNum = 1;
    }
}

const ANIM_WIDTH = 8;
const ANIM_HEIGHT = 6;
const ANIM_POS = v(1, 7);

// prettier-ignore
const MENU_ANIMATIONS: Record<string, string[]> = {
    A: [
        "    *   " + "     *  " + "     *  " + "   ***  " + "        " + "*****   ",
        "        " + "     *  " + "     *  " + "   ***  " + "       *" + "    ****",
        "    *  *" + "     * *" + "     * *" + "   *** *" + "       *" + "        ",
        "    ****" + "     * *" + "     * *" + "   ***  " + "        " + "        ",
    ],
    B: [
        "        " + "        " + "********" + "   **** " + "********" + "   *    ",
        "        " + "        " + "********" + "*  * ***" + "********" + "        ",
        "        " + "   *    " + "********" + "***    *" + "********" + "        ",
        "   *    " + "        " + "********" + " ****   " + "********" + "        ",
    ],
    C: [
        "** ***  " + "    * **" + "        " + "        " + "    *   " + "   ***  ",
        "** ***  " + "      **" + "        " + "        " + "    *   " + "   ***  ",
        "** * *  " + "      **" + "        " + "        " + "    *   " + "   ***  ",
        "** *    " + "      **" + "        " + "        " + "     *  " + "    *** ",
    ],
};

/** Port of Games/MainMenu/MainMenuAnimation.gd. */
class MainMenuAnimation {
    public letter: string;
    private frame = 0;
    private timer = new TickTimer(45);

    constructor() {
        this.letter = "A";
        this.timer.onTriggered = () => {
            this.frame = (this.frame + 1) % 4;
        };
    }

    public setLetter(letter: string) {
        this.letter = letter;
        this.frame = 0;
        this.timer.reset();
    }

    public tick() {
        this.timer.tick();
    }

    public render(mainScreen: PixelArray) {
        const anim = MENU_ANIMATIONS[this.letter];
        if (!anim) return;
        for (let x = 0; x < ANIM_WIDTH; x += 1) {
            for (let y = 0; y < ANIM_HEIGHT; y += 1) {
                mainScreen.setPixel(
                    ANIM_POS.x + x,
                    ANIM_POS.y + y,
                    anim[this.frame][y * ANIM_WIDTH + x] === "*",
                );
            }
        }
    }
}

/** Port of Games/MainMenu/MainMenu.gd. */
export class MainMenu extends GameState {
    private letter = new MainMenuLetter();
    private number = new MainMenuNumber();
    private animation = new MainMenuAnimation();

    constructor(root: GameRoot) {
        super(root);
        this.animation.setLetter(this.letter.getCurrent());
    }

    override bgTick() {
        this.letter.tick();
        this.animation.tick();
    }

    override bgRender() {
        const mainScreen = this.device.mainScreen;
        mainScreen.clear();
        this.letter.render(mainScreen);
        this.number.render(mainScreen);
        this.animation.render(mainScreen);
    }

    override bgFocus() {
        this.device.hintScreen.clear();
    }

    private openGame() {
        const currentLetter = this.letter.getCurrent();
        switch (currentLetter) {
            case "A":
                this.root.pushState(new Snake(this.root));
                break;
            case "B":
                this.root.pushState(new Frogger(this.root));
                break;
            case "D":
                this.root.pushState(new Arkanoid(this.root));
                break;
        }
    }

    override bgInput(event: DeviceEvent) {
        if (event.type !== "key" || !event.pressed) return;
        switch (event.key) {
            case "right":
                this.letter.nextLetter();
                this.animation.setLetter(this.letter.getCurrent());
                this.number.currentNum = 1;
                break;
            case "left":
                this.letter.prevLetter();
                this.animation.setLetter(this.letter.getCurrent());
                this.number.currentNum = 1;
                break;
            case "up":
                this.number.nextNumber();
                break;
            case "down":
                this.number.prevNumber();
                break;
            case "start":
                this.letter.resetAnim();
                this.openGame();
                break;
            case "exit":
                this.root.popState();
                break;
        }
    }
}
