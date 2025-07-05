export const getIsPrintable = (char: string) => {
  if (char < "\x20" || char === "\x7f") {
    return false;
  }
  return true;
};
