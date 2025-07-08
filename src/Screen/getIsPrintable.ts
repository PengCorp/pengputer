export const getIsPrintable = (char: string) => {
  if (char < "\x20" || (char >= "\x7f" && char <= "\x9f")) {
    return false;
  }
  return true;
};
