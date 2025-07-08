export enum ColorType {
  Classic = 0,
  Indexed = 1,
  Direct = 2,
}

export interface ClassicColor {
  type: ColorType.Classic;
  index: number;
}

export interface IndexedColor {
  type: ColorType.Indexed;
  index: number;
}

export interface DirectColor {
  type: ColorType.Direct;
  r: number;
  g: number;
  b: number;
}

export type Color = ClassicColor | IndexedColor | DirectColor;

export const isColorValue = (a: number | undefined) => {
  return a !== undefined && a >= 0 && a < 256;
};
