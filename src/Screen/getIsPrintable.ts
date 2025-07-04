const nonPrintableCharacters = ["\0", "\n", "\r", "\b", "\x1b"];

export const getIsPrintable = (char: string) => {
  return !nonPrintableCharacters.includes(char);
};
