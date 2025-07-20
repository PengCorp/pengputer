import {
  classicColors,
  getDirectColor,
  indexedColors,
  namedColors,
} from "../Color/ansi";
import { ColorType } from "../Color/Color";
import {
  BOXED,
  BOXED_BOTTOM,
  BOXED_LEFT,
  BOXED_RIGHT,
  BOXED_TOP,
} from "../TextBuffer";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const CHAR = "  ";

export class Colors implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }

  private async runAnsiTest() {
    const { std } = this.pc;
    std.resetConsole();
    std.clearConsole();

    // fg regular

    std.updateConsoleAttributes({
      fgColor: classicColors[1],
    });
    std.writeConsole("Red");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[2],
    });
    std.writeConsole("Green");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[4],
    });
    std.writeConsole("Blue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // fg intense

    std.updateConsoleAttributes({
      fgColor: classicColors[9],
    });
    std.writeConsole("IRed");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[10],
    });
    std.writeConsole("IGreen");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[12],
    });
    std.writeConsole("IBlue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // bg regular

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[1],
    });
    std.writeConsole("Red");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[2],
    });
    std.writeConsole("Green");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[4],
    });
    std.writeConsole("Blue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // bg intense

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[9],
    });
    std.writeConsole("IRed");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[10],
    });
    std.writeConsole("IGreen");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: classicColors[0],
      bgColor: classicColors[12],
    });
    std.writeConsole("IBlue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    //

    std.updateConsoleAttributes({
      fgColor: indexedColors[90],
      bgColor: indexedColors[212],
    });
    std.writeConsole("256 colors");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    std.updateConsoleAttributes({
      fgColor: getDirectColor(230, 255, 210),
      bgColor: getDirectColor(45, 75, 45),
    });
    std.writeConsole("24-bit color");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    std.updateConsoleAttributes({ blink: true });
    std.writeConsole("Blink");
    std.resetConsoleAttributes();
    std.writeConsole(" and no blink\n");

    std.updateConsoleAttributes({ bold: true });
    std.writeConsole("Bold");
    std.resetConsoleAttributes();
    std.writeConsole(" and no bold\n");

    std.updateConsoleAttributes({ reverseVideo: true });
    std.writeConsole("Reverse");
    std.resetConsoleAttributes();
    std.writeConsole(" and no reverse\n");

    std.updateConsoleAttributes({ underline: true });
    std.writeConsole("Underline");
    std.resetConsoleAttributes();
    std.writeConsole(" and no underline\n");

    std.updateConsoleAttributes({ halfBright: true });
    std.writeConsole("Half-bright");
    std.resetConsoleAttributes();
    std.writeConsole(" and regular\n");

    std.updateConsoleAttributes({
      boxed: BOXED_LEFT | BOXED_TOP | BOXED_BOTTOM,
    });
    std.writeConsole("B");
    std.updateConsoleAttributes({ boxed: BOXED_TOP | BOXED_BOTTOM });
    std.writeConsole("oxe");
    std.updateConsoleAttributes({
      boxed: BOXED_RIGHT | BOXED_TOP | BOXED_BOTTOM,
    });
    std.writeConsole("d");
    std.resetConsoleAttributes();
    std.writeConsole(" and not boxed. Full box: ");
    std.updateConsoleAttributes({ boxed: BOXED });
    std.writeConsole(".\n");
    std.resetConsoleAttributes();

    std.updateConsoleAttributes({
      fgColor: classicColors[3],
    });
    std.writeConsole("Classic");
    std.updateConsoleAttributes({ bold: true });
    std.writeConsole(" Yellow");
    std.resetConsoleAttributes();
    std.writeConsole(" and ");
    std.updateConsoleAttributes({
      fgColor: indexedColors[3],
    });
    std.writeConsole("Indexed");
    std.updateConsoleAttributes({
      fgColor: indexedColors[11],
    });
    std.writeConsole(" Yellow");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    std.updateConsoleAttributes({
      fgColor: classicColors["orange"],
    });
    std.writeConsole("Classic");
    std.updateConsoleAttributes({
      fgColor: classicColors["lightOrange"],
    });
    std.writeConsole(" Orange");
    std.resetConsoleAttributes();
    std.writeConsole(" (28-color extended classic palette)\n");

    std.writeConsole("Press ENTER to continue...");
    await std.readConsoleLine();
  }

  private async runPaletteTest() {
    const { std } = this.pc;
    std.resetConsole();
    std.clearConsole();
    std.writeConsole("Classic colors\n");

    for (let i = 0; i < 0x08; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: classicColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x08; i < 0x10; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: classicColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x10; i < 0x18; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: classicColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x18; i < 0x20; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: classicColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    std.writeConsole("Press ENTER to continue...");
    await std.readConsoleLine();

    std.resetConsole();
    std.clearConsole();
    std.writeConsole("Indexed colors\n");

    for (let i = 0; i < 0x08; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: indexedColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x08; i < 0x10; i += 1) {
      std.writeConsole(CHAR, {
        bgColor: indexedColors[i],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");

    std.writeConsole("Press ENTER to continue...");
    await std.readConsoleLine();

    for (let z = 0; z < 6; z += 1) {
      std.clearConsole();
      std.writeConsole(`216-color cube, page ${z}\n`);
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 6; x += 1) {
          std.writeConsole(CHAR, {
            bgColor: indexedColors[16 + z * 6 * 6 + y * 6 + x],
          });
        }
        std.resetConsole();
        std.writeConsole("\n");
      }
      std.writeConsole("Press ENTER to continue...");
      await std.readConsoleLine();
    }

    std.clearConsole();
    std.writeConsole("Gray scale\n");
    for (let g = 0; g < 24; g += 1) {
      std.writeConsole(CHAR, {
        bgColor: indexedColors[232 + g],
      });
    }
    std.resetConsole();
    std.writeConsole("\n");
    std.writeConsole("Press ENTER to continue...");
    await std.readConsoleLine();

    std.resetConsole();
    std.clearConsole();
  }

  async run(args: string[]) {
    await this.runAnsiTest();
    await this.runPaletteTest();
  }
}
