export const PATH_SEPARATOR = "/";
export const LSKEY_FLOPPIES = "floppies";

export const DriveLetterValues: string[] = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
] as const;

export type DriveLetter = (typeof DriveLetterValues)[number];

export function isDriveLetter(letter: string): letter is DriveLetter {
    return DriveLetterValues.includes(letter);
}
