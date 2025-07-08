import { char } from "../types";
import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { KeyCode } from "./KeyCode";

export const arrowKeyMap: Record<
  "set" | "reset",
  Partial<Record<KeyCode, char[]>>
> = {
  set: {
    ArrowUp: [ControlCharacter.SS3, "A"],
    ArrowDown: [ControlCharacter.SS3, "B"],
    ArrowRight: [ControlCharacter.SS3, "C"],
    ArrowLeft: [ControlCharacter.SS3, "D"],
  },
  reset: {
    ArrowUp: [ControlCharacter.CSI, "A"],
    ArrowDown: [ControlCharacter.CSI, "B"],
    ArrowRight: [ControlCharacter.CSI, "C"],
    ArrowLeft: [ControlCharacter.CSI, "D"],
  },
};
