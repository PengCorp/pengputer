import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { ScreenCharacter } from "./types";

export class ScreenBuffer {
  private buffer: Array<ScreenCharacter>;

  constructor(width: number, height: number) {
    this.buffer = new Array<ScreenCharacter>(width * height);
    for (let i = 0; i < width * height; i += 1) {
      this.buffer[i] = {
        character: " ",
        attributes: {
          bgColor: CGA_PALETTE_DICT[CgaColors.Black],
          fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
          blink: false,
        },
      };
    }
  }
}
