const nonPrintableCharacters = ["\0", "\n", "\r", "\b"];

export const getIsPrintable = (char: string) => {
  return !nonPrintableCharacters.includes(char);
};
