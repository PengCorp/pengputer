import { CGA_PALETTE_DICT } from "./cgaPalette";
import { CgaColors } from "./types";
import tc from "tinycolor2";

export const x256ClassicColors = new Array(32).fill(
  CGA_PALETTE_DICT[CgaColors.Black]
);

x256ClassicColors[0x00] = CGA_PALETTE_DICT[CgaColors.Black];
x256ClassicColors[0x01] = CGA_PALETTE_DICT[CgaColors.Red];
x256ClassicColors[0x02] = CGA_PALETTE_DICT[CgaColors.Green];
x256ClassicColors[0x03] = CGA_PALETTE_DICT[CgaColors.Yellow];
x256ClassicColors[0x04] = CGA_PALETTE_DICT[CgaColors.Blue];
x256ClassicColors[0x05] = CGA_PALETTE_DICT[CgaColors.Magenta];
x256ClassicColors[0x06] = CGA_PALETTE_DICT[CgaColors.Cyan];
x256ClassicColors[0x07] = CGA_PALETTE_DICT[CgaColors.LightGray];

x256ClassicColors[0x08] = CGA_PALETTE_DICT[CgaColors.DarkGray];
x256ClassicColors[0x09] = CGA_PALETTE_DICT[CgaColors.LightRed];
x256ClassicColors[0x0a] = CGA_PALETTE_DICT[CgaColors.LightGreen];
x256ClassicColors[0x0b] = CGA_PALETTE_DICT[CgaColors.LightYellow];
x256ClassicColors[0x0c] = CGA_PALETTE_DICT[CgaColors.LightBlue];
x256ClassicColors[0x0d] = CGA_PALETTE_DICT[CgaColors.LightMagenta];
x256ClassicColors[0x0e] = CGA_PALETTE_DICT[CgaColors.LightCyan];
x256ClassicColors[0x0f] = CGA_PALETTE_DICT[CgaColors.White];

x256ClassicColors[0x10] = CGA_PALETTE_DICT[CgaColors.Orange];
x256ClassicColors[0x11] = CGA_PALETTE_DICT[CgaColors.Chartreuse];
x256ClassicColors[0x12] = CGA_PALETTE_DICT[CgaColors.SpringGreen];
x256ClassicColors[0x13] = CGA_PALETTE_DICT[CgaColors.Azure];
x256ClassicColors[0x14] = CGA_PALETTE_DICT[CgaColors.Violet];
x256ClassicColors[0x15] = CGA_PALETTE_DICT[CgaColors.Rose];
x256ClassicColors[0x16] = CGA_PALETTE_DICT[CgaColors.Black];
x256ClassicColors[0x17] = CGA_PALETTE_DICT[CgaColors.Black];

x256ClassicColors[0x18] = CGA_PALETTE_DICT[CgaColors.LightOrange];
x256ClassicColors[0x19] = CGA_PALETTE_DICT[CgaColors.LightChartreuse];
x256ClassicColors[0x1a] = CGA_PALETTE_DICT[CgaColors.LightSpringGreen];
x256ClassicColors[0x1b] = CGA_PALETTE_DICT[CgaColors.LightAzure];
x256ClassicColors[0x1c] = CGA_PALETTE_DICT[CgaColors.LightViolet];
x256ClassicColors[0x1d] = CGA_PALETTE_DICT[CgaColors.LightRose];
x256ClassicColors[0x1e] = CGA_PALETTE_DICT[CgaColors.Black];
x256ClassicColors[0x1f] = CGA_PALETTE_DICT[CgaColors.Black];

export const getBoldClassicIndex = (index: number) => {
  if (Math.floor(index / 8) % 2 === 0) {
    return index + 8;
  }
  return index;
};

const x256Colors = new Array<string>(256).fill(
  CGA_PALETTE_DICT[CgaColors.Black]
);

x256Colors[0x00] = "#000000";
x256Colors[0x01] = "#800000";
x256Colors[0x02] = "#008000";
x256Colors[0x03] = "#808000";
x256Colors[0x04] = "#000080";
x256Colors[0x05] = "#800080";
x256Colors[0x06] = "#008080";
x256Colors[0x07] = "#c0c0c0";

x256Colors[0x08] = "#808080";
x256Colors[0x09] = "#ff0000";
x256Colors[0x0a] = "#00ff00";
x256Colors[0x0b] = "#ffff00";
x256Colors[0x0c] = "#0000ff";
x256Colors[0x0d] = "#ff00ff";
x256Colors[0x0e] = "#00ffff";
x256Colors[0x0f] = "#ffffff";

for (let red = 0; red < 6; red += 1) {
  for (let green = 0; green < 6; green += 1) {
    for (let blue = 0; blue < 6; blue += 1) {
      const code = 16 + red * 36 + green * 6 + blue;
      const r = red !== 0 ? red * 40 + 55 : 0;
      const g = green !== 0 ? green * 40 + 55 : 0;
      const b = blue !== 0 ? blue * 40 + 55 : 0;
      x256Colors[code] = tc({ r, g, b }).toHexString();
    }
  }
}

for (let gray = 0; gray < 24; gray += 1) {
  const level = gray * 10 + 8;
  const code = 232 + gray;
  x256Colors[code] = tc({ r: level, g: level, b: level }).toHexString();
}

export { x256Colors };

export enum x256Color {
  Black = 0x00,
  Red = 0x01,
  Green = 0x02,
  Yellow = 0x03,
  Blue = 0x04,
  Magenta = 0x05,
  Cyan = 0x06,
  LightGray = 0x07,
  DarkGray = 0x08,
  LightRed = 0x09,
  LightGreen = 0x0a,
  LightYellow = 0x0b,
  LightBlue = 0x0c,
  LightMagenta = 0x0d,
  LightCyan = 0x0e,
  White = 0x0f,

  Orange = 0x100,
  Chartreuse = 0x101,
  SpringGreen = 0x102,
  Azure = 0x103,
  Violet = 0x104,
  Rose = 0x105,

  LightOrange = 0x108,
  LightChartreuse = 0x109,
  LightSpringGreen = 0x10a,
  LightAzure = 0x10b,
  LightViolet = 0x10c,
  LightRose = 0x10d,
}

export const getBoldColor = (color: string) => {
  const index = x256Colors.findIndex((c) => c === color);

  if (!index) {
    return color;
  }

  if (index >= 0x00 && index < 0x08) {
    return x256Color[index + 0x08];
  }
  if (index >= 0x100 && index < 0x108) {
    return x256Color[index + 0x08];
  }

  return x256Color[index];
};
