/*
 * The handheld device: the LCD main screen, the small "hint" screen used for
 * lives, and the segment number displays - plus the terminal rendering that
 * paints them. The whole device block is centered on the 80x25 console.
 */

import _ from "lodash";
import { classicColors } from "@Color/ansi";
import { type Std } from "../../Std";
import { PixelArray, SegmentDisplay } from "./core";

const HISCORE_STORAGE_KEY = "brickgame.hiscore";

export class Device {
    public mainScreen = new PixelArray(10, 20);
    public hintScreen = new PixelArray(4, 4);
    public scoreDisplay = new SegmentDisplay(6);
    public hiScoreDisplay = new SegmentDisplay(6);
    public speedDisplay = new SegmentDisplay(1);
    public levelDisplay = new SegmentDisplay(1);

    constructor() {
        const stored = Number(localStorage.getItem(HISCORE_STORAGE_KEY));
        this.hiScoreDisplay.value = Number.isFinite(stored) ? stored : 0;
    }

    private updateHiScore() {
        const score = this.scoreDisplay.value ?? 0;
        const hi = this.hiScoreDisplay.value ?? 0;
        if (score > hi) {
            this.hiScoreDisplay.value = score;
            localStorage.setItem(HISCORE_STORAGE_KEY, String(score));
        }
    }

    /* ----- layout (computed so the block is centered) ----- */

    private static readonly GAP = 3;
    private static readonly PANEL_WIDTH = 16;

    // Origin of the framed grid (top-left of the frame), the grid interior, the
    // title row and the side panel - all filled in by computeLayout().
    private frameX = 0;
    private titleY = 0;
    private gridX = 0;
    private gridY = 0;
    private panelX = 0;

    private computeLayout(std: Std) {
        const size = std.getConsoleSize();
        const frameWidth = this.mainScreen.arraySize.x * 2 + 2;
        const blockWidth = frameWidth + Device.GAP + Device.PANEL_WIDTH;
        // title row + frame top + grid rows + frame bottom
        const blockHeight = this.mainScreen.arraySize.y + 3;

        const originX = Math.max(0, Math.floor((size.w - blockWidth) / 2));
        const originY = Math.max(0, Math.floor((size.h - blockHeight) / 2));

        this.frameX = originX;
        this.titleY = originY;
        this.gridX = originX + 1;
        this.gridY = originY + 2;
        this.panelX = originX + frameWidth + Device.GAP;
    }

    /* ----- attributes ----- */

    private static readonly ON_ATTR = {
        bgColor: classicColors["green"],
        fgColor: classicColors["lightGreen"],
    };
    private static readonly OFF_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
    };
    private static readonly FRAME_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["lightGray"],
    };
    private static readonly TITLE_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["lightGreen"],
    };
    private static readonly LABEL_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["lightGreen"],
    };
    private static readonly VALUE_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["white"],
    };
    private static readonly DIM_ATTR = {
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
    };

    private drawCell(std: Std, sx: number, sy: number, on: boolean) {
        std.setConsoleCursorPosition({ x: sx, y: sy });
        if (on) {
            std.writeConsole("[]", Device.ON_ATTR);
        } else {
            std.writeConsole(" .", Device.OFF_ATTR);
        }
    }

    private writeAt(
        std: Std,
        x: number,
        y: number,
        text: string,
        attr: object,
    ) {
        std.setConsoleCursorPosition({ x, y });
        std.writeConsole(text, attr);
    }

    private drawFrame(std: Std) {
        const x = this.frameX;
        const inner = this.mainScreen.arraySize.x * 2;
        this.writeAt(
            std,
            x,
            this.gridY - 1,
            "╔" + "═".repeat(inner) + "╗",
            Device.FRAME_ATTR,
        );
        for (let row = 0; row < this.mainScreen.arraySize.y; row += 1) {
            this.writeAt(std, x, this.gridY + row, "║", Device.FRAME_ATTR);
            this.writeAt(
                std,
                x + inner + 1,
                this.gridY + row,
                "║",
                Device.FRAME_ATTR,
            );
        }
        this.writeAt(
            std,
            x,
            this.gridY + this.mainScreen.arraySize.y,
            "╚" + "═".repeat(inner) + "╝",
            Device.FRAME_ATTR,
        );
    }

    private drawMainScreen(std: Std) {
        for (let y = 0; y < this.mainScreen.arraySize.y; y += 1) {
            for (let x = 0; x < this.mainScreen.arraySize.x; x += 1) {
                this.drawCell(
                    std,
                    this.gridX + x * 2,
                    this.gridY + y,
                    this.mainScreen.getPixel(x, y),
                );
            }
        }
    }

    private formatNumber(display: SegmentDisplay): string {
        if (display.value === null) return " ".repeat(display.digits);
        return _.padStart(String(display.value), display.digits).slice(
            -display.digits,
        );
    }

    private drawPanel(std: Std) {
        const px = this.panelX;
        const gy = this.gridY;

        this.writeAt(std, px, gy, "== SCORE ==", Device.LABEL_ATTR);
        this.writeAt(
            std,
            px,
            gy + 1,
            this.formatNumber(this.scoreDisplay),
            Device.VALUE_ATTR,
        );

        this.writeAt(std, px, gy + 3, "== HI-SCORE ==", Device.LABEL_ATTR);
        this.writeAt(
            std,
            px,
            gy + 4,
            this.formatNumber(this.hiScoreDisplay),
            Device.VALUE_ATTR,
        );

        this.writeAt(
            std,
            px,
            gy + 6,
            "SPEED " + this.formatNumber(this.speedDisplay),
            Device.LABEL_ATTR,
        );
        this.writeAt(
            std,
            px,
            gy + 7,
            "LEVEL " + this.formatNumber(this.levelDisplay),
            Device.LABEL_ATTR,
        );

        this.writeAt(std, px, gy + 9, "== LIVES ==", Device.LABEL_ATTR);
        for (let y = 0; y < this.hintScreen.arraySize.y; y += 1) {
            for (let x = 0; x < this.hintScreen.arraySize.x; x += 1) {
                this.drawCell(
                    std,
                    px + x * 2,
                    gy + 10 + y,
                    this.hintScreen.getPixel(x, y),
                );
            }
        }

        this.writeAt(std, px, gy + 16, "== CONTROLS ==", Device.LABEL_ATTR);
        this.writeAt(std, px, gy + 17, "Arrows  - move", Device.DIM_ATTR);
        this.writeAt(std, px, gy + 18, "Z/Space - fire", Device.DIM_ATTR);
        this.writeAt(std, px, gy + 19, "Enter   - start", Device.DIM_ATTR);
        this.writeAt(std, px, gy + 20, "Esc     - exit", Device.DIM_ATTR);
    }

    public drawChrome(std: Std) {
        this.computeLayout(std);
        const title = "B R I C K   G A M E   9 9 9 9";
        const frameWidth = this.mainScreen.arraySize.x * 2 + 2;
        const blockWidth = frameWidth + Device.GAP + Device.PANEL_WIDTH;
        this.writeAt(
            std,
            this.frameX + Math.floor((blockWidth - title.length) / 2),
            this.titleY,
            title,
            Device.TITLE_ATTR,
        );
        this.drawFrame(std);
    }

    public draw(std: Std) {
        this.computeLayout(std);
        this.updateHiScore();
        this.drawMainScreen(std);
        this.drawPanel(std);
    }
}
