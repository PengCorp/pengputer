import { x256Colors } from "../Color/ansi";
import { ColorType } from "../PengTerm";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const CHAR = "  ";

export class Colors implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }

  private async runAnsiTest() {
    const { std, term } = this.pc;
    std.resetConsole();
    std.clearConsole();
    term.write("\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m\n");
    term.write(
      "\x1b[30;91mIRed\x1b[0m \x1b[92mIGreen\x1b[0m \x1b[94mIBlue\x1b[0m\n"
    );
    term.write(
      "\x1b[30;41mRed\x1b[0m \x1b[30;42mGreen\x1b[0m \x1b[30;44mBlue\x1b[0m\n"
    );
    term.write(
      "\x1b[30;101mIRed\x1b[0m \x1b[30;102mIGreen\x1b[0m \x1b[30;104mIBlue\x1b[0m\n"
    );
    term.write("\x1b[38;5;90;48;5;212m256 indexed colors\x1b[0m\n");
    term.write(
      "\x1b[38;2;230;255;210;48;2;45;75;45m24-bit true color\x1b[0m\n"
    );
    term.write("\x1b[5mBlink\x1b[25m and no blink\x1b[0m\n");
    term.write("\x1b[1mBold\x1b[22m and no bold\x1b[0m\n");
    term.write(
      "\x1b[38;5;70mNo \x1b[1mBold\x1b[22m on indexed colors\x1b[0m\n"
    );
    term.write("\x1b[7mReverse\x1b[27m and no reverse\x1b[0m\n");
    term.write("\x1b[21mUnderline\x1b[24m and no underline\x1b[0m\n");
    term.write("\x1b[2mHalf-bright\x1b[22m and regular\x1b[0m\n");
    term.write(
      "\x1b[33mClassic \x1b[1myellow\x1b[0m and \x1b[38;5;3mindexed \x1b[38;5;11myellow\x1b[0m\n"
    );
    term.write(
      "\x1b[38;10;16mClassic \x1b[1morange\x1b[0m (28-color extended classic palette)\n"
    );

    term.write("Press ENTER to continue...");
    await std.readConsoleLine();
  }

  private async runPaletteTest() {
    const { std } = this.pc;
    std.resetConsole();
    std.clearConsole();
    std.writeConsole("Standard colors\n");

    for (let i = 0; i < 0x08; i += 1) {
      const attr = std.getConsoleAttributes();
      attr.bgColor = { type: ColorType.Classic, index: i };
      std.setConsoleAttributes(attr);
      std.writeConsole(CHAR);
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x08; i < 0x10; i += 1) {
      const attr = std.getConsoleAttributes();
      attr.bgColor = { type: ColorType.Classic, index: i };
      std.setConsoleAttributes(attr);
      std.writeConsole(CHAR);
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x10; i < 0x18; i += 1) {
      const attr = std.getConsoleAttributes();
      attr.bgColor = { type: ColorType.Classic, index: i };
      std.setConsoleAttributes(attr);
      std.writeConsole(CHAR);
    }
    std.resetConsole();
    std.writeConsole("\n");

    for (let i = 0x18; i < 0x20; i += 1) {
      const attr = std.getConsoleAttributes();
      attr.bgColor = { type: ColorType.Classic, index: i };
      std.setConsoleAttributes(attr);
      std.writeConsole(CHAR);
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
          const attr = std.getConsoleAttributes();
          attr.bgColor = {
            type: ColorType.Indexed,
            index: 16 + z * 6 * 6 + y * 6 + x,
          };
          std.setConsoleAttributes(attr);
          std.writeConsole(CHAR);
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
      const attr = std.getConsoleAttributes();
      attr.bgColor = { type: ColorType.Indexed, index: 232 + g };
      std.setConsoleAttributes(attr);
      std.writeConsole(CHAR);
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
