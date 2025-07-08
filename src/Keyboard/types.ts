import { KeyCode } from "./KeyCode";

export interface KeyboardEvent {
  code: KeyCode;

  /** `true` if key is pressed down. */
  pressed: boolean;
}
