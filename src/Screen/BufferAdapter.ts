import {
  getBoldClassicIndex,
  classicColorRgbValues,
  indexedColorRgbValues,
} from "../Color/ansi";
import { ColorType } from "../Color/Color";
import { type CellAttributes } from "../TextBuffer";
import { type ScreenCharacterAttributes } from "./types";
import tc from "tinycolor2";

export const getScreenCharacterAttributesFromTermCellAttributes = (
  cellAttr: CellAttributes,
): ScreenCharacterAttributes => {
  const cellFgColor = cellAttr.fgColor;
  const cellBgColor = cellAttr.bgColor;

  let fgColor = "black";
  switch (cellFgColor.type) {
    case ColorType.Classic:
      fgColor = cellAttr.bold
        ? classicColorRgbValues[getBoldClassicIndex(cellFgColor.index)]
        : classicColorRgbValues[cellFgColor.index];
      break;
    case ColorType.Indexed:
      fgColor = indexedColorRgbValues[cellFgColor.index];
      break;
    case ColorType.Direct:
      fgColor = tc(cellFgColor).toHexString();
      break;
  }

  let bgColor = "black";
  switch (cellBgColor.type) {
    case ColorType.Classic:
      bgColor = classicColorRgbValues[cellBgColor.index];
      break;
    case ColorType.Indexed:
      bgColor = indexedColorRgbValues[cellBgColor.index];
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
    boxed: cellAttr.boxed,
  };
};
