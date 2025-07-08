import {
  getBoldClassicIndex,
  x256ClassicColors,
  x256Colors,
} from "../Color/ansi";
import { ColorType } from "../Color/Color";
import { CellAttributes } from "../PengTerm/PengTerm";
import { ScreenCharacterAttributes } from "./types";
import tc from "tinycolor2";

export const getScreenCharacterAttributesFromTermCellAttributes = (
  termAttr: CellAttributes
): ScreenCharacterAttributes => {
  const cellFgColor = termAttr.fgColor;
  const cellBgColor = termAttr.bgColor;

  let fgColor = "black";
  switch (cellFgColor.type) {
    case ColorType.Classic:
      fgColor = termAttr.bold
        ? x256ClassicColors[getBoldClassicIndex(cellFgColor.index)]
        : x256ClassicColors[cellFgColor.index];
      break;
    case ColorType.Indexed:
      fgColor = x256Colors[cellFgColor.index];
      break;
    case ColorType.Direct:
      fgColor = tc(cellFgColor).toHexString();
      break;
  }

  let bgColor = "black";
  switch (cellBgColor.type) {
    case ColorType.Classic:
      bgColor = x256ClassicColors[cellBgColor.index];
      break;
    case ColorType.Indexed:
      bgColor = x256Colors[cellBgColor.index];
      break;
    case ColorType.Direct:
      bgColor = tc(cellBgColor).toHexString();
      break;
  }

  return {
    fgColor,
    bgColor,
    bold: false,
    blink: termAttr.blink,
    reverseVideo: termAttr.reverseVideo,
    underline: termAttr.underline,
    halfBright: termAttr.halfBright,
  };
};
