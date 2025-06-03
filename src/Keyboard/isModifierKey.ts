const MODIFIER_KEYS = [
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
  "AltGraph",
];

export const getIsModifierKey = (code: string) => {
  return MODIFIER_KEYS.includes(code);
};
