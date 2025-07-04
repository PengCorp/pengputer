import { CGA_PALETTE_DICT } from "./cgaPalette";
import { CgaColors } from "./types";
import tc from "tinycolor2";

const x256Colors = new Array(512).fill(null);

x256Colors[0x00] = CGA_PALETTE_DICT[CgaColors.Black];
x256Colors[0x01] = CGA_PALETTE_DICT[CgaColors.Red];
x256Colors[0x02] = CGA_PALETTE_DICT[CgaColors.Green];
x256Colors[0x03] = CGA_PALETTE_DICT[CgaColors.Yellow];
x256Colors[0x04] = CGA_PALETTE_DICT[CgaColors.Blue];
x256Colors[0x05] = CGA_PALETTE_DICT[CgaColors.Magenta];
x256Colors[0x06] = CGA_PALETTE_DICT[CgaColors.Cyan];
x256Colors[0x07] = CGA_PALETTE_DICT[CgaColors.LightGray];

x256Colors[0x08] = CGA_PALETTE_DICT[CgaColors.DarkGray];
x256Colors[0x09] = CGA_PALETTE_DICT[CgaColors.LightRed];
x256Colors[0x0a] = CGA_PALETTE_DICT[CgaColors.LightGreen];
x256Colors[0x0b] = CGA_PALETTE_DICT[CgaColors.LightYellow];
x256Colors[0x0c] = CGA_PALETTE_DICT[CgaColors.LightBlue];
x256Colors[0x0d] = CGA_PALETTE_DICT[CgaColors.LightMagenta];
x256Colors[0x0e] = CGA_PALETTE_DICT[CgaColors.LightCyan];
x256Colors[0x0f] = CGA_PALETTE_DICT[CgaColors.White];

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

x256Colors[0x100] = CGA_PALETTE_DICT[CgaColors.Orange];
x256Colors[0x101] = CGA_PALETTE_DICT[CgaColors.Chartreuse];
x256Colors[0x102] = CGA_PALETTE_DICT[CgaColors.SpringGreen];
x256Colors[0x103] = CGA_PALETTE_DICT[CgaColors.Azure];
x256Colors[0x104] = CGA_PALETTE_DICT[CgaColors.Violet];
x256Colors[0x105] = CGA_PALETTE_DICT[CgaColors.Rose];
x256Colors[0x106] = CGA_PALETTE_DICT[CgaColors.Black];
x256Colors[0x107] = CGA_PALETTE_DICT[CgaColors.Black];

x256Colors[0x108] = CGA_PALETTE_DICT[CgaColors.LightOrange];
x256Colors[0x109] = CGA_PALETTE_DICT[CgaColors.LightChartreuse];
x256Colors[0x10a] = CGA_PALETTE_DICT[CgaColors.LightSpringGreen];
x256Colors[0x10b] = CGA_PALETTE_DICT[CgaColors.LightAzure];
x256Colors[0x10c] = CGA_PALETTE_DICT[CgaColors.LightViolet];
x256Colors[0x10d] = CGA_PALETTE_DICT[CgaColors.LightRose];
x256Colors[0x10e] = CGA_PALETTE_DICT[CgaColors.Black];
x256Colors[0x10f] = CGA_PALETTE_DICT[CgaColors.Black];

x256Colors[0x110] = CGA_PALETTE_DICT[CgaColors.BackgroundBlack];
x256Colors[0x111] = CGA_PALETTE_DICT[CgaColors.BackgroundRed];
x256Colors[0x112] = CGA_PALETTE_DICT[CgaColors.BackgroundGreen];
x256Colors[0x113] = CGA_PALETTE_DICT[CgaColors.BackgroundYellow];
x256Colors[0x114] = CGA_PALETTE_DICT[CgaColors.BackgroundBlue];
x256Colors[0x115] = CGA_PALETTE_DICT[CgaColors.BackgroundMagenta];
x256Colors[0x116] = CGA_PALETTE_DICT[CgaColors.BackgroundCyan];
x256Colors[0x117] = CGA_PALETTE_DICT[CgaColors.BackgroundLightGray];

x256Colors[0x118] = CGA_PALETTE_DICT[CgaColors.BackgroundOrange];
x256Colors[0x119] = CGA_PALETTE_DICT[CgaColors.BackgroundChartreuse];
x256Colors[0x11a] = CGA_PALETTE_DICT[CgaColors.BackgroundSpringGreen];
x256Colors[0x11b] = CGA_PALETTE_DICT[CgaColors.BackgroundAzure];
x256Colors[0x11c] = CGA_PALETTE_DICT[CgaColors.BackgroundViolet];
x256Colors[0x11d] = CGA_PALETTE_DICT[CgaColors.BackgroundRose];
x256Colors[0x11e] = CGA_PALETTE_DICT[CgaColors.Black];
x256Colors[0x11f] = CGA_PALETTE_DICT[CgaColors.Black];

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

  BackgroundBlack = 0x110,
  BackgroundRed = 0x111,
  BackgroundGreen = 0x112,
  BackgroundYellow = 0x113,
  BackgroundBlue = 0x114,
  BackgroundMagenta = 0x115,
  BackgroundCyan = 0x116,
  BackgroundLightGray = 0x117,

  BackgroundOrange = 0x118,
  BackgroundChartreuse = 0x119,
  BackgroundSpringGreen = 0x11a,
  BackgroundAzure = 0x11b,
  BackgroundViolet = 0x11c,
  BackgroundRose = 0x11d,
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
