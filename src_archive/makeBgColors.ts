import { CGA_PALETTE_DICT } from "./cgaPalette";
import { CgaColors } from "./types";
import tc from "tinycolor2";

export function makeBgColors(colors: Record<string, string>) {
  const out: Record<string, number> = {};
  const bgColors: Record<string, string> = {};

  for (const [key, intenseKey] of Object.entries(colors)) {
    console["log"](
      `${key}/${intenseKey}: ${
        tc(CGA_PALETTE_DICT[key]).toHsl().l /
        tc(CGA_PALETTE_DICT[intenseKey]).toHsl().l
      }`
    );
    out[key] =
      tc(CGA_PALETTE_DICT[key]).toHsl().l /
      tc(CGA_PALETTE_DICT[intenseKey]).toHsl().l;
    const bgColor = tc(CGA_PALETTE_DICT[key]).toHsl();
    bgColor.l = bgColor.l / 2;
    bgColors[key] = tc(bgColor).toHexString();
  }

  console["log"](bgColors);
}

makeBgColors({
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
});
