import { type Executable } from "@FileSystem/fileTypes";
import { type PC } from "./PC";
import { biosSettings, type BIOSSettingsData } from "./BIOSSettings";
import { applyFullScreenState } from "./util";
import { classicColors } from "@Color/ansi";
import _ from "lodash";

const MENU_ITEM_ZOOM = 0;
const MENU_ITEM_FONT = 1;
const MENU_ITEM_COUNT = 2;

const MENU_ITEM_DESCRIPTIONS: Record<number, string> = {
    [MENU_ITEM_FONT]:
        "Selects which bitmap font is used to render text on this display.",
    [MENU_ITEM_ZOOM]: "Toggles full-screen zoom mode for the browser window.",
};

const EXPLANATION_WIDTH = 78;

export class BIOS implements Executable {
    private pc: PC;
    constructor(pc: PC) {
        this.pc = pc;
    }

    // prettier-ignore
    private printBorder = () => {
        const { std } = this.pc;

        std.setConsoleCursorPosition({ x: 0, y: 0 });
        std.writeConsole('            PM-BIOS Setup Utility - Copyright (C) 1982-1985 PengCorp            ');
        std.writeConsole('╔══════════════════════════════════════════════════════════════════════════════╗');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');

        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');

        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('╟──────────────────────────────────────────────────────────────────────────────╢');
        std.writeConsole('║                                                                              ║');

        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('╟──────────────────────────────────────────────────────────────────────────────╢');
        std.writeConsole('║ Esc : Exit without saving              ↑ ↓ : Select Item                     ║');
        std.writeConsole('║ S   : Save and exit                    ← → : Change Item                     ║');

        std.writeConsole('╚══════════════════════════════════════════════════════════════════════════════╝');
    }

    async run(args: string[]) {
        const { std } = this.pc;

        let selectedMenuItem = 0;
        const pendingSettings: BIOSSettingsData = {
            ...biosSettings.getSettings(),
        };

        std.resetConsole();
        std.updateConsoleAttributes({
            fgColor: classicColors["lightGray"],
            bgColor: classicColors["blue"],
        });
        std.clearConsole();
        std.setIsConsoleCursorVisible(false);
        this.printBorder();

        const renderMenuItem = (
            title: string,
            value: string,
            isSelected: boolean,
        ) => {
            std.writeConsole(`${_.padEnd(title, 16, " ")}`);
            std.updateConsoleAttributes({ fgColor: classicColors["yellow"] });
            if (isSelected) {
                std.updateConsoleAttributes({ bgColor: classicColors["red"] });
            }
            std.writeConsole(value);
            std.updateConsoleAttributes({ bgColor: classicColors["blue"] });
            std.writeConsole(`            `);
            std.updateConsoleAttributes({
                fgColor: classicColors["lightGray"],
            });
        };

        const renderMenu = () => {
            std.setConsoleCursorPosition({ x: 2, y: 2 });
            renderMenuItem(
                "Zoom",
                pendingSettings.zoom ? "On" : "Off",
                selectedMenuItem === MENU_ITEM_ZOOM,
            );
            std.setConsoleCursorPosition({ x: 2, y: 3 });
            renderMenuItem(
                "Font",
                pendingSettings.font === "vga" ? "VGA" : "Terminus",
                selectedMenuItem === MENU_ITEM_FONT,
            );
        };

        const renderExplanation = () => {
            const description = MENU_ITEM_DESCRIPTIONS[selectedMenuItem] ?? "";
            const leftPad = Math.max(
                Math.floor((EXPLANATION_WIDTH - description.length) / 2),
                0,
            );
            const rightPad = Math.max(
                EXPLANATION_WIDTH - description.length - leftPad,
                0,
            );
            std.setConsoleCursorPosition({ x: 1, y: 19 });
            std.writeConsole(
                `${" ".repeat(leftPad)}${description}${" ".repeat(rightPad)}`,
            );
        };

        renderMenu();
        renderExplanation();

        while (true) {
            const { key } = await std.readConsoleKey();
            if (key === "Escape") {
                break;
            }
            if (key === "ArrowLeft" || key === "ArrowRight") {
                switch (selectedMenuItem) {
                    case MENU_ITEM_FONT:
                        pendingSettings.font =
                            pendingSettings.font === "vga" ? "terminus" : "vga";
                        break;
                    case MENU_ITEM_ZOOM:
                        pendingSettings.zoom = !pendingSettings.zoom;
                        break;
                }
                renderMenu();
            }
            if (key === "ArrowUp") {
                selectedMenuItem -= 1;
                if (selectedMenuItem < 0) {
                    selectedMenuItem = 0;
                }
                renderMenu();
                renderExplanation();
            }
            if (key === "ArrowDown") {
                selectedMenuItem += 1;
                if (selectedMenuItem >= MENU_ITEM_COUNT) {
                    selectedMenuItem = MENU_ITEM_COUNT - 1;
                }
                renderMenu();
                renderExplanation();
            }
            if (key === "KeyS") {
                biosSettings.setSettings({ ...pendingSettings });
                applyFullScreenState();
                break;
            }
        }
    }
}
