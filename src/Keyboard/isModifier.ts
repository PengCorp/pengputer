const MODIFIER_CODES = [
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

const MODIFIER_KEYS = [
  "Shift", "Control",
  "Alt", "Meta", "CapsLock"
];

function code(code: string) {
  return MODIFIER_CODES.includes(code);
};
function event(ev: KeyboardEvent) {
  return MODIFIER_KEYS.includes(ev.key);
};

export default { code, event };
export { code, event };
