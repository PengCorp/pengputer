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

export enum FileMode {
    NONE = 0,
    EXECUTE = 1<<0, /* execute as program or run special action */
    READ = 1<<1,    /* be read; [should be] needed to execute */
    WRITE = 1<<2,   /* be written to. only matters for text files */
    WRX = 7
};
