import { CgaColors } from "./types";

export const CGA_PALETTE_DICT: Record<CgaColors, string> = {
  [CgaColors.Black]: "#000000",
  [CgaColors.Red]: "#c40000",
  [CgaColors.Green]: "#00c400",
  [CgaColors.Blue]: "#0000c4",
  [CgaColors.Yellow]: "#c4c400",
  [CgaColors.Cyan]: "#00c4c4",
  [CgaColors.Magenta]: "#c400c4",
  [CgaColors.Orange]: "#c47e00",
  [CgaColors.Chartreuse]: "#7ec400",
  [CgaColors.SpringGreen]: "#00c47e",
  [CgaColors.Azure]: "#007ec4",
  [CgaColors.Violet]: "#7e00c4",
  [CgaColors.Rose]: "#c4007e",
  [CgaColors.LightGray]: "#c4c4c4",

  [CgaColors.DarkGray]: "#4e4e4e",
  [CgaColors.LightRed]: "#dc4e4e",
  [CgaColors.LightGreen]: "#4edc4e",
  [CgaColors.LightBlue]: "#4e4edc",
  [CgaColors.LightYellow]: "#f3f34e",
  [CgaColors.LightCyan]: "#4ef3f3",
  [CgaColors.LightMagenta]: "#f34ef3",
  [CgaColors.LightOrange]: "#e8b14e",
  [CgaColors.LightChartreuse]: "#b1e84e",
  [CgaColors.LightSpringGreen]: "#4ee8b1",
  [CgaColors.LightAzure]: "#4eb1e8",
  [CgaColors.LightViolet]: "#b14ee8",
  [CgaColors.LightRose]: "#e84eb1",
  [CgaColors.White]: "#ffffff",
};

export const CGA_PALETTE = [
  CgaColors.Black, // 00
  CgaColors.Blue, // 01
  CgaColors.Green, // 02
  CgaColors.Cyan, // 03
  CgaColors.Red, // 04
  CgaColors.Magenta, // 05
  CgaColors.Yellow, // 06
  CgaColors.LightGray, // 07

  CgaColors.DarkGray, // 08
  CgaColors.LightBlue, // 09
  CgaColors.LightGreen, // 0A
  CgaColors.LightCyan, // 0B
  CgaColors.LightRed, // 0C
  CgaColors.LightMagenta, // 0D
  CgaColors.LightYellow, // 0E
  CgaColors.White, // 0F

  CgaColors.Orange, // 10
  CgaColors.Chartreuse, // 11
  CgaColors.SpringGreen, // 12
  CgaColors.Azure, // 13
  CgaColors.Violet, // 14
  CgaColors.Rose, // 15
  CgaColors.Black, // 16
  CgaColors.Black, // 17

  CgaColors.LightOrange, // 18
  CgaColors.LightChartreuse, // 19
  CgaColors.LightSpringGreen, // 1A
  CgaColors.LightAzure, // 1B
  CgaColors.LightViolet, // 1C
  CgaColors.LightRose, // 1D
  CgaColors.Black, // 1E
  CgaColors.Black, // 1F
];

export const CGA_BOLD_MAP = Object.entries({
  [CgaColors.Black]: CgaColors.DarkGray,
  [CgaColors.Red]: CgaColors.LightRed,
  [CgaColors.Green]: CgaColors.LightGreen,
  [CgaColors.Blue]: CgaColors.LightBlue,
  [CgaColors.Yellow]: CgaColors.LightYellow,
  [CgaColors.Cyan]: CgaColors.LightCyan,
  [CgaColors.Magenta]: CgaColors.LightMagenta,
  [CgaColors.Orange]: CgaColors.LightOrange,
  [CgaColors.Chartreuse]: CgaColors.LightChartreuse,
  [CgaColors.SpringGreen]: CgaColors.LightSpringGreen,
  [CgaColors.Azure]: CgaColors.LightAzure,
  [CgaColors.Violet]: CgaColors.LightViolet,
  [CgaColors.Rose]: CgaColors.LightRose,
  [CgaColors.LightGray]: CgaColors.White,
} satisfies Partial<Record<CgaColors, CgaColors>>).reduce<
  Record<string, string>
>(
  (acc, [k, v]) => ({
    ...acc,
    [CGA_PALETTE_DICT[k as CgaColors]]: CGA_PALETTE_DICT[v],
  }),
  {}
);
