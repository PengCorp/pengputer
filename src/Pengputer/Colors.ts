import { x256Color, x256Colors } from "../Color/ansi";
import { ColorType } from "../Color/Color";
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
      fgColor: { type: ColorType.Classic, index: 1 },
    });
    std.writeConsole("Red");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 2 },
    });
    std.writeConsole("Green");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 4 },
    });
    std.writeConsole("Blue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // fg intense

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 9 },
    });
    std.writeConsole("IRed");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 10 },
    });
    std.writeConsole("IGreen");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 12 },
    });
    std.writeConsole("IBlue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // bg regular

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 1 },
    });
    std.writeConsole("Red");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 2 },
    });
    std.writeConsole("Green");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 4 },
    });
    std.writeConsole("Blue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    // bg intense

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 9 },
    });
    std.writeConsole("IRed");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 10 },
    });
    std.writeConsole("IGreen");
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: 0 },
      bgColor: { type: ColorType.Classic, index: 12 },
    });
    std.writeConsole("IBlue");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    //

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Indexed, index: 90 },
      bgColor: { type: ColorType.Indexed, index: 212 },
    });
    std.writeConsole("256 colors");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Direct, r: 230, g: 255, b: 210 },
      bgColor: { type: ColorType.Direct, r: 45, g: 75, b: 45 },
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
      fgColor: { type: ColorType.Classic, index: 3 },
    });
    std.writeConsole("Classic");
    std.updateConsoleAttributes({ bold: true });
    std.writeConsole(" Yellow");
    std.resetConsoleAttributes();
    std.writeConsole(" and ");
    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Indexed, index: 3 },
    });
    std.writeConsole("Indexed");
    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Indexed, index: 11 },
    });
    std.writeConsole(" Yellow");
    std.resetConsoleAttributes();
    std.writeConsole("\n");

    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: x256Color.Orange },
    });
    std.writeConsole("Classic");
    std.updateConsoleAttributes({
      fgColor: { type: ColorType.Classic, index: x256Color.LightOrange },
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
