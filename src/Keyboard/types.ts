import { KeyCode } from "./types.keyCode";
export { KeyCode };

export interface PengKeyboardEvent {
  code: KeyCode;
  char: string | null;
  pressed: boolean;
  isAutoRepeat: boolean;
  isModifier: boolean;

  isShiftDown?: boolean;
  isControlDown?: boolean;
  isAltDown?: boolean;
  isMetaDown?: boolean;
  isCapsOn?: boolean;
}
