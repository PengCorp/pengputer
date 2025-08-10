import type { KeyCode } from "./types.keyCode";
export type { KeyCode };

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

export enum Modifier {
  SHIFT = 1 << 0,
  CONTROL = 1 << 1,
  ALT = 1 << 2,
  META = 1 << 3,
  CAPS_LOCK = 1 << 4,
  ALL_MODIFIERS = Modifier.SHIFT |
    Modifier.CONTROL |
    Modifier.ALT |
    Modifier.META |
    Modifier.CAPS_LOCK,
}
