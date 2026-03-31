export const isNil = <T>(v: T | null | undefined): v is T => {
  return v === null || v === undefined;
};

export const isFalsy = (v: unknown) => {
  return !Boolean(v);
};

export const isTruthy = (v: unknown) => {
  return Boolean(v);
};

export type RecordValue<T> = T[keyof T];
export type RecordKey<T> = keyof T;

export const assert = (
  condition: unknown,
  message: string,
  ErrorType: new (message: string) => Error = Error
) => {
  if (!Boolean(condition)) {
    throw new ErrorType(message);
  }
};

export const gridToString = <T>(
  grid: Array<T>,
  width: number,
  height: number,
  toString: (value: T) => string = String
) => {
  const strings: Array<Array<string>> = [];
  for (let y = 0; y < height; y += 1) {
    const row: Array<string> = [];
    for (let x = 0; x < width; x += 1) {
      row.push(toString(grid[y * width + x]));
    }
    strings.push(row);
  }

  let maxw = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      maxw = Math.max(maxw, strings[y][x].length);
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      strings[y][x] = strings[y][x].padStart(maxw);
    }
  }

  let result = "";
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      result += strings[y][x];
      if (x < width - 1) {
        result += "   ";
      }
    }
    if (y < height - 1) {
      result += "\n";
    }
  }

  return result;
};
