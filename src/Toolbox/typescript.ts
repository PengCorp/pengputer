export function isNil<T>(value: T): value is Extract<T, null | undefined> {
  return value === null || value === undefined;
}
