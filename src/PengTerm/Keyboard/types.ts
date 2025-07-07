import { KeyCode } from "./KeyCode";

export interface KeyboardEvent {
  code: KeyCode;

  /** `true` if key is pressed down. */
  pressed: boolean;
}

export interface Keyboard {
  take(): KeyboardEvent | undefined;
  getIsKeyPressed(keyCode: KeyCode): void;
  getIsShift(): boolean;
}
