import {
  getBoldClassicIndex,
  x256ClassicColors,
  x256Colors,
} from "../Color/ansi";
import { ColorType } from "../Color/Color";
import { CellAttributes } from "../TextBuffer/TextBuffer";
import { ScreenCharacterAttributes } from "./types";
import tc from "tinycolor2";

export const getScreenCharacterAttributesFromTermCellAttributes = (
  cellAttr: CellAttributes
): ScreenCharacterAttributes => {
  const cellFgColor = cellAttr.fgColor;
  const cellBgColor = cellAttr.bgColor;

  let fgColor = "black";
  switch (cellFgColor.type) {
    case ColorType.Classic:
      fgColor = cellAttr.bold
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
    blink: cellAttr.blink,
    reverseVideo: cellAttr.reverseVideo,
    underline: cellAttr.underline,
    halfBright: cellAttr.halfBright,
  };
};
