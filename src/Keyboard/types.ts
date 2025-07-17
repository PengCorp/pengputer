import { KeyCode } from "./types.keyCode";
export { KeyCode };

export interface PengKeyboardEvent {
  code: KeyCode;
  pressed: boolean;

  isShiftDown?: boolean;
  isControlDown?: boolean;
  isAltDown?: boolean;
  isMetaDown?: boolean;
  isCapsOn?: boolean;
}
