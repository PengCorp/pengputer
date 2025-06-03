const nonPrintableCharacters = ["\0", "\n", "\r", "\b", "\x1B"];

export const getIsPrintable = (char: string) => {
  return !nonPrintableCharacters.includes(char);
};
