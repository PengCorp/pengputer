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

  // [CgaColors.BackgroundBlack]: "#000000",
  // [CgaColors.BackgroundRed]: "#410000",
  // [CgaColors.BackgroundGreen]: "#004100",
  // [CgaColors.BackgroundBlue]: "#000041",
  // [CgaColors.BackgroundYellow]: "#414100",
  // [CgaColors.BackgroundCyan]: "#004141",
  // [CgaColors.BackgroundMagenta]: "#410041",
  // [CgaColors.BackgroundOrange]: "#412a00",
  // [CgaColors.BackgroundChartreuse]: "#2a4100",
  // [CgaColors.BackgroundSpringGreen]: "#00412a",
  // [CgaColors.BackgroundAzure]: "#002a41",
  // [CgaColors.BackgroundViolet]: "#2a0041",
  // [CgaColors.BackgroundRose]: "#41002a",
  // [CgaColors.BackgroundLightGray]: "#414141",

  [CgaColors.BackgroundBlack]: "#000000",
  [CgaColors.BackgroundRed]: "#620000",
  [CgaColors.BackgroundGreen]: "#006200",
  [CgaColors.BackgroundBlue]: "#000062",
  [CgaColors.BackgroundYellow]: "#626200",
  [CgaColors.BackgroundCyan]: "#006262",
  [CgaColors.BackgroundMagenta]: "#620062",
  [CgaColors.BackgroundOrange]: "#623f00",
  [CgaColors.BackgroundChartreuse]: "#3f6200",
  [CgaColors.BackgroundSpringGreen]: "#00623f",
  [CgaColors.BackgroundAzure]: "#003f62",
  [CgaColors.BackgroundViolet]: "#3f0062",
  [CgaColors.BackgroundRose]: "#62003f",
  [CgaColors.BackgroundLightGray]: "#626262",
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

  CgaColors.BackgroundBlack, // 20
  CgaColors.BackgroundBlue, // 21
  CgaColors.BackgroundGreen, // 22
  CgaColors.BackgroundCyan, // 23
  CgaColors.BackgroundRed, // 24
  CgaColors.BackgroundMagenta, // 25
  CgaColors.BackgroundYellow, // 26
  CgaColors.BackgroundLightGray, // 27

  CgaColors.Black, // 28
  CgaColors.Black, // 29
  CgaColors.Black, // 2A
  CgaColors.Black, // 2B
  CgaColors.Black, // 2C
  CgaColors.Black, // 2D
  CgaColors.Black, // 2E
  CgaColors.Black, // 2F

  CgaColors.BackgroundOrange, // 30
  CgaColors.BackgroundChartreuse, // 31
  CgaColors.BackgroundSpringGreen, // 32
  CgaColors.BackgroundAzure, // 33
  CgaColors.BackgroundViolet, // 34
  CgaColors.BackgroundRose, // 35
  CgaColors.Black, // 36
  CgaColors.Black, // 37
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
