import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { KeyCode } from "./KeyCode";

/**
 * If shift - use shift, fall back to regular.
 * If caps - use caps, fall back to regular.
 * If capsShift - use capsShift, fall back to regular.
 * If control - use, no fallback.
 */
interface MapEntry {
  regular: string;
  shift: string;
  caps: string;
  capsShift: string;
  control?: string;
}

const getSingleStateEntry = (char: string): MapEntry => {
  return {
    regular: char,
    shift: char,
    caps: char,
    capsShift: char,
  };
};

const getRegularKeyEntry = (lower: string, upper: string): MapEntry => {
  return {
    regular: lower,
    shift: upper,
    caps: upper,
    capsShift: lower,
  };
};

const getShiftOnlyEntry = (lower: string, upper: string): MapEntry => {
  return {
    regular: lower,
    shift: upper,
    caps: lower,
    capsShift: upper,
  };
};

const addControlCharacter = (controlCharacter: string, map: MapEntry) => {
  map.control = controlCharacter;
  return map;
};

export const codeToCharacterUS: Partial<Record<KeyCode, MapEntry>> = {
  Space: addControlCharacter(ControlCharacter.NUL, getSingleStateEntry(" ")),
  Backspace: getSingleStateEntry(ControlCharacter.BS),
  Delete: getSingleStateEntry(ControlCharacter.DEL),
  Tab: getSingleStateEntry(ControlCharacter.HT),

  KeyA: addControlCharacter(ControlCharacter.SOH, getRegularKeyEntry("a", "A")),
  KeyB: addControlCharacter(ControlCharacter.STX, getRegularKeyEntry("b", "B")),
  KeyC: addControlCharacter(ControlCharacter.ETX, getRegularKeyEntry("c", "C")),
  KeyD: addControlCharacter(ControlCharacter.EOT, getRegularKeyEntry("d", "D")),
  KeyE: addControlCharacter(ControlCharacter.ENQ, getRegularKeyEntry("e", "E")),
  KeyF: addControlCharacter(ControlCharacter.ACK, getRegularKeyEntry("f", "F")),
  KeyG: addControlCharacter(ControlCharacter.BEL, getRegularKeyEntry("g", "G")),
  KeyH: addControlCharacter(ControlCharacter.BS, getRegularKeyEntry("h", "H")),
  KeyI: addControlCharacter(ControlCharacter.HT, getRegularKeyEntry("i", "I")),
  KeyJ: addControlCharacter(ControlCharacter.LF, getRegularKeyEntry("j", "J")),
  KeyK: addControlCharacter(ControlCharacter.VT, getRegularKeyEntry("k", "K")),
  KeyL: addControlCharacter(ControlCharacter.FF, getRegularKeyEntry("l", "L")),
  KeyM: addControlCharacter(ControlCharacter.CR, getRegularKeyEntry("m", "M")),
  KeyN: addControlCharacter(ControlCharacter.SO, getRegularKeyEntry("n", "N")),
  KeyO: addControlCharacter(ControlCharacter.SI, getRegularKeyEntry("o", "O")),
  KeyP: addControlCharacter(ControlCharacter.DLE, getRegularKeyEntry("p", "P")),
  KeyQ: addControlCharacter(ControlCharacter.DC1, getRegularKeyEntry("q", "Q")),
  KeyR: addControlCharacter(ControlCharacter.DC2, getRegularKeyEntry("r", "R")),
  KeyS: addControlCharacter(ControlCharacter.DC3, getRegularKeyEntry("s", "S")),
  KeyT: addControlCharacter(ControlCharacter.DC4, getRegularKeyEntry("t", "T")),
  KeyU: addControlCharacter(ControlCharacter.NAK, getRegularKeyEntry("u", "U")),
  KeyV: addControlCharacter(ControlCharacter.SYN, getRegularKeyEntry("v", "V")),
  KeyW: addControlCharacter(ControlCharacter.ETB, getRegularKeyEntry("w", "W")),
  KeyX: addControlCharacter(ControlCharacter.CAN, getRegularKeyEntry("x", "X")),
  KeyY: addControlCharacter(ControlCharacter.EM, getRegularKeyEntry("y", "Y")),
  KeyZ: addControlCharacter(ControlCharacter.SUB, getRegularKeyEntry("z", "Z")),

  Comma: getShiftOnlyEntry(",", "<"),
  Period: getShiftOnlyEntry(".", ">"),
  Slash: addControlCharacter(ControlCharacter.FS, getShiftOnlyEntry("/", "?")),
  Semicolon: getShiftOnlyEntry(";", ":"),
  Quote: getShiftOnlyEntry("'", '"'),
  BracketLeft: addControlCharacter(
    ControlCharacter.ESC,
    getShiftOnlyEntry("[", "{")
  ),
  BracketRight: addControlCharacter(
    ControlCharacter.GS,
    getShiftOnlyEntry("]", "}")
  ),
  Digit1: getShiftOnlyEntry("1", "!"),
  Digit2: addControlCharacter(
    ControlCharacter.NUL,
    getShiftOnlyEntry("2", "@")
  ),
  Digit3: addControlCharacter(
    ControlCharacter.ESC,
    getShiftOnlyEntry("3", "#")
  ),
  Digit4: addControlCharacter(ControlCharacter.FS, getShiftOnlyEntry("4", "$")),
  Digit5: addControlCharacter(ControlCharacter.GS, getShiftOnlyEntry("5", "%")),
  Digit6: addControlCharacter(ControlCharacter.RS, getShiftOnlyEntry("6", "^")),
  Digit7: addControlCharacter(ControlCharacter.US, getShiftOnlyEntry("7", "&")),
  Digit8: addControlCharacter(
    ControlCharacter.DEL,
    getShiftOnlyEntry("8", "*")
  ),
  Digit9: getShiftOnlyEntry("9", "("),
  Digit0: getShiftOnlyEntry("0", ")"),
  Minus: getShiftOnlyEntry("-", "_"),
  Equal: getShiftOnlyEntry("=", "+"),
  Backslash: getShiftOnlyEntry("\\", "|"),
  Backquote: addControlCharacter(
    ControlCharacter.RS,
    getShiftOnlyEntry("`", "~")
  ),

  Numpad1: getSingleStateEntry("1"),
  Numpad2: getSingleStateEntry("2"),
  Numpad3: getSingleStateEntry("3"),
  Numpad4: getSingleStateEntry("4"),
  Numpad5: getSingleStateEntry("5"),
  Numpad6: getSingleStateEntry("6"),
  Numpad7: getSingleStateEntry("7"),
  Numpad8: getSingleStateEntry("8"),
  Numpad9: getSingleStateEntry("9"),
  Numpad0: getSingleStateEntry("0"),
  NumpadDecimal: getSingleStateEntry("."),
  NumpadAdd: getSingleStateEntry("+"),
  NumpadSubtract: getSingleStateEntry("-"),
  NumpadMultiply: getSingleStateEntry("*"),
  NumpadDivide: getSingleStateEntry("/"),
};
