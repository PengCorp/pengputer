export const PATH_SEPARATOR = "/";
export const LSKEY_FLOPPIES = "floppies";

export const DriveLabelValues: string[] = [
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

export type DriveLabel = (typeof DriveLabelValues)[number];

export function isDriveLabel(label: string): label is DriveLabel {
  return DriveLabelValues.includes(label);
}
