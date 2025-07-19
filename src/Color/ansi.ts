import { CGA_PALETTE_DICT } from "./cgaPalette";
import { Color, ColorType } from "./Color";
import { CgaColors } from "./types";
import tc from "tinycolor2";

export const classicColorRgbValues = new Array(32).fill(
  CGA_PALETTE_DICT[CgaColors.Black],
);

classicColorRgbValues[0x00] = CGA_PALETTE_DICT[CgaColors.Black];
classicColorRgbValues[0x01] = CGA_PALETTE_DICT[CgaColors.Red];
classicColorRgbValues[0x02] = CGA_PALETTE_DICT[CgaColors.Green];
classicColorRgbValues[0x03] = CGA_PALETTE_DICT[CgaColors.Yellow];
classicColorRgbValues[0x04] = CGA_PALETTE_DICT[CgaColors.Blue];
classicColorRgbValues[0x05] = CGA_PALETTE_DICT[CgaColors.Magenta];
classicColorRgbValues[0x06] = CGA_PALETTE_DICT[CgaColors.Cyan];
classicColorRgbValues[0x07] = CGA_PALETTE_DICT[CgaColors.LightGray];

classicColorRgbValues[0x08] = CGA_PALETTE_DICT[CgaColors.DarkGray];
classicColorRgbValues[0x09] = CGA_PALETTE_DICT[CgaColors.LightRed];
classicColorRgbValues[0x0a] = CGA_PALETTE_DICT[CgaColors.LightGreen];
classicColorRgbValues[0x0b] = CGA_PALETTE_DICT[CgaColors.LightYellow];
classicColorRgbValues[0x0c] = CGA_PALETTE_DICT[CgaColors.LightBlue];
classicColorRgbValues[0x0d] = CGA_PALETTE_DICT[CgaColors.LightMagenta];
classicColorRgbValues[0x0e] = CGA_PALETTE_DICT[CgaColors.LightCyan];
classicColorRgbValues[0x0f] = CGA_PALETTE_DICT[CgaColors.White];

classicColorRgbValues[0x10] = CGA_PALETTE_DICT[CgaColors.Orange];
classicColorRgbValues[0x11] = CGA_PALETTE_DICT[CgaColors.Chartreuse];
classicColorRgbValues[0x12] = CGA_PALETTE_DICT[CgaColors.SpringGreen];
classicColorRgbValues[0x13] = CGA_PALETTE_DICT[CgaColors.Azure];
classicColorRgbValues[0x14] = CGA_PALETTE_DICT[CgaColors.Violet];
classicColorRgbValues[0x15] = CGA_PALETTE_DICT[CgaColors.Rose];
classicColorRgbValues[0x16] = CGA_PALETTE_DICT[CgaColors.Black];
classicColorRgbValues[0x17] = CGA_PALETTE_DICT[CgaColors.Black];

classicColorRgbValues[0x18] = CGA_PALETTE_DICT[CgaColors.LightOrange];
classicColorRgbValues[0x19] = CGA_PALETTE_DICT[CgaColors.LightChartreuse];
classicColorRgbValues[0x1a] = CGA_PALETTE_DICT[CgaColors.LightSpringGreen];
classicColorRgbValues[0x1b] = CGA_PALETTE_DICT[CgaColors.LightAzure];
classicColorRgbValues[0x1c] = CGA_PALETTE_DICT[CgaColors.LightViolet];
classicColorRgbValues[0x1d] = CGA_PALETTE_DICT[CgaColors.LightRose];
classicColorRgbValues[0x1e] = CGA_PALETTE_DICT[CgaColors.Black];
classicColorRgbValues[0x1f] = CGA_PALETTE_DICT[CgaColors.Black];

const classicColors: Record<string, Color> = {};

for (let i = 0; i < 0x20; i += 1) {
  classicColors[i] = { type: ColorType.Classic, index: i };
}

classicColors["black"] = { type: ColorType.Classic, index: 0x00 };
classicColors["red"] = { type: ColorType.Classic, index: 0x01 };
classicColors["green"] = { type: ColorType.Classic, index: 0x02 };
classicColors["yellow"] = { type: ColorType.Classic, index: 0x03 };
classicColors["blue"] = { type: ColorType.Classic, index: 0x04 };
classicColors["magenta"] = { type: ColorType.Classic, index: 0x05 };
classicColors["cyan"] = { type: ColorType.Classic, index: 0x06 };
classicColors["lightGray"] = { type: ColorType.Classic, index: 0x07 };

classicColors["darkGray"] = { type: ColorType.Classic, index: 0x08 };
classicColors["lightRed"] = { type: ColorType.Classic, index: 0x09 };
classicColors["lightGreen"] = { type: ColorType.Classic, index: 0x0a };
classicColors["lightYellow"] = { type: ColorType.Classic, index: 0x0b };
classicColors["lightBlue"] = { type: ColorType.Classic, index: 0x0c };
classicColors["lightMagenta"] = { type: ColorType.Classic, index: 0x0d };
classicColors["lightCyan"] = { type: ColorType.Classic, index: 0x0e };
classicColors["white"] = { type: ColorType.Classic, index: 0x0f };

classicColors["orange"] = { type: ColorType.Classic, index: 0x10 };
classicColors["chartreuse"] = { type: ColorType.Classic, index: 0x11 };
classicColors["springGreen"] = { type: ColorType.Classic, index: 0x12 };
classicColors["azure"] = { type: ColorType.Classic, index: 0x13 };
classicColors["violet"] = { type: ColorType.Classic, index: 0x14 };
classicColors["rose"] = { type: ColorType.Classic, index: 0x15 };
classicColors["black"] = { type: ColorType.Classic, index: 0x16 };
classicColors["black"] = { type: ColorType.Classic, index: 0x17 };

classicColors["lightOrange"] = { type: ColorType.Classic, index: 0x18 };
classicColors["lightChartreuse"] = { type: ColorType.Classic, index: 0x19 };
classicColors["lightSpringGreen"] = { type: ColorType.Classic, index: 0x1a };
classicColors["lightAzure"] = { type: ColorType.Classic, index: 0x1b };
classicColors["lightViolet"] = { type: ColorType.Classic, index: 0x1c };
classicColors["lightRose"] = { type: ColorType.Classic, index: 0x1d };
classicColors["black"] = { type: ColorType.Classic, index: 0x1e };
classicColors["black"] = { type: ColorType.Classic, index: 0x1f };

export { classicColors };

export const getBoldClassicIndex = (index: number) => {
  if (Math.floor(index / 8) % 2 === 0) {
    return index + 8;
  }
  return index;
};

const indexedColorRgbValues = new Array<string>(256).fill(
  CGA_PALETTE_DICT[CgaColors.Black],
);

indexedColorRgbValues[0x00] = "#000000";
indexedColorRgbValues[0x01] = "#800000";
indexedColorRgbValues[0x02] = "#008000";
indexedColorRgbValues[0x03] = "#808000";
indexedColorRgbValues[0x04] = "#000080";
indexedColorRgbValues[0x05] = "#800080";
indexedColorRgbValues[0x06] = "#008080";
indexedColorRgbValues[0x07] = "#c0c0c0";

indexedColorRgbValues[0x08] = "#808080";
indexedColorRgbValues[0x09] = "#ff0000";
indexedColorRgbValues[0x0a] = "#00ff00";
indexedColorRgbValues[0x0b] = "#ffff00";
indexedColorRgbValues[0x0c] = "#0000ff";
indexedColorRgbValues[0x0d] = "#ff00ff";
indexedColorRgbValues[0x0e] = "#00ffff";
indexedColorRgbValues[0x0f] = "#ffffff";

for (let red = 0; red < 6; red += 1) {
  for (let green = 0; green < 6; green += 1) {
    for (let blue = 0; blue < 6; blue += 1) {
      const code = 16 + red * 36 + green * 6 + blue;
      const r = red !== 0 ? red * 40 + 55 : 0;
      const g = green !== 0 ? green * 40 + 55 : 0;
      const b = blue !== 0 ? blue * 40 + 55 : 0;
      indexedColorRgbValues[code] = tc({ r, g, b }).toHexString();
    }
  }
}

for (let gray = 0; gray < 24; gray += 1) {
  const level = gray * 10 + 8;
  const code = 232 + gray;
  indexedColorRgbValues[code] = tc({
    r: level,
    g: level,
    b: level,
  }).toHexString();
}

export { indexedColorRgbValues };

const indexedColors: Array<Color> = [];
for (let i = 0; i < 0x100; i += 1) {
  indexedColors[i] = { type: ColorType.Indexed, index: i };
}
export { indexedColors };

export const getDirectColor = (r: number, g: number, b: number): Color => {
  return { type: ColorType.Direct, r, g, b };
};

export enum namedColors {
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

  Orange = 0x10,
  Chartreuse = 0x11,
  SpringGreen = 0x12,
  Azure = 0x13,
  Violet = 0x14,
  Rose = 0x15,

  LightOrange = 0x18,
  LightChartreuse = 0x19,
  LightSpringGreen = 0x1a,
  LightAzure = 0x1b,
  LightViolet = 0x1c,
  LightRose = 0x1d,
}

export const getBoldColorIndex = (color: string) => {
  const index = indexedColorRgbValues.findIndex((c) => c === color);

  if (!index) {
    return color;
  }

  if (index >= 0x00 && index < 0x08) {
    return namedColors[index + 0x08];
  }
  if (index >= 0x100 && index < 0x108) {
    return namedColors[index + 0x08];
  }

  return namedColors[index];
};
