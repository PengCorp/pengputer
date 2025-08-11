import type { KeyCode } from "./types.keyCode";

const MODIFIER_CODES: KeyCode[] = [
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
] as const;

const MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock"];

export function getIsCodeModifier(code: KeyCode) {
  return MODIFIER_CODES.includes(code);
}
export function getIsEventModifier(ev: KeyboardEvent) {
  return (
    MODIFIER_KEYS.includes(ev.key) || getIsCodeModifier(ev.code as KeyCode)
  );
}
