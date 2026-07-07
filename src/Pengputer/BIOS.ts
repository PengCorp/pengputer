import { type Executable } from "@FileSystem/fileTypes";
import { type PC } from "./PC";
import { biosSettings } from "./BIOSSettings";
import { classicColors } from "@Color/ansi";
import _ from "lodash";

const MENU_ITEM_FONT = 0;
const MENU_ITEM_COUNT = 1;

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
        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');

        std.writeConsole('║                                                                              ║');
        std.writeConsole('║                                                                              ║');
        std.writeConsole('╟──────────────────────────────────────────────────────────────────────────────╢');
        std.writeConsole('║ Esc : Quit                             ↑ ↓ : Select Item                     ║');
        std.writeConsole('║                                        ← → : Change Item                     ║');

        std.writeConsole('╚══════════════════════════════════════════════════════════════════════════════╝');
    }

    async run(args: string[]) {
        const { std } = this.pc;

        let selectedMenuItem = 0;

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
                "Font",
                biosSettings.getSetting("font") === "vga" ? "VGA" : "Terminus",
                selectedMenuItem === MENU_ITEM_FONT,
            );
        };

        renderMenu();

        while (true) {
            const { key } = await std.readConsoleKey();
            if (key === "Escape") {
                break;
            }
            if (key === "ArrowLeft") {
                switch (selectedMenuItem) {
                    case 0:
                        biosSettings.setSetting(
                            "font",
                            biosSettings.getSetting("font") === "vga"
                                ? "terminus"
                                : "vga",
                        );
                        break;
                }
                renderMenu();
            }
            if (key === "ArrowRight") {
                switch (selectedMenuItem) {
                    case 0:
                        biosSettings.setSetting(
                            "font",
                            biosSettings.getSetting("font") === "vga"
                                ? "terminus"
                                : "vga",
                        );
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
            }
            if (key === "ArrowDown") {
                selectedMenuItem += 1;
                if (selectedMenuItem >= MENU_ITEM_COUNT) {
                    selectedMenuItem = MENU_ITEM_COUNT - 1;
                }
                renderMenu();
            }
        }
    }
}
