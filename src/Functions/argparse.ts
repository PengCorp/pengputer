interface TokenData {
  start: number;
  token: string;
  end: number;
}

const getToken = (argsString: string, index: number): TokenData | null => {
  let tokenStartIndex = index;
  let tokenEndIndex = 0;
  let tokenData = "";

  // move start index to start of token
  while (
    tokenStartIndex < argsString.length &&
    argsString[tokenStartIndex] === " "
  ) {
    tokenStartIndex += 1;
  }

  tokenEndIndex = tokenStartIndex;

  if (tokenEndIndex === argsString.length) {
    return null;
  }

  if (argsString[tokenEndIndex] === '"') {
    // parse string token

    // skip opening quote
    tokenEndIndex += 1;
    while (
      tokenEndIndex < argsString.length &&
      argsString[tokenEndIndex] !== '"'
    ) {
      if (
        tokenEndIndex < argsString.length - 1 &&
        argsString[tokenEndIndex] === "\\"
      ) {
        if (argsString[tokenEndIndex + 1] === '"') {
          tokenData += '"';
          tokenEndIndex += 2;
        } else {
          tokenData += argsString[tokenEndIndex];
          tokenEndIndex += 1;
        }
      } else {
        tokenData += argsString[tokenEndIndex];
        tokenEndIndex += 1;
      }
    }
    tokenEndIndex = Math.min(tokenEndIndex + 1, argsString.length);
  } else {
    while (
      tokenEndIndex < argsString.length &&
      argsString[tokenEndIndex] !== " "
    ) {
      tokenEndIndex += 1;
    }
    tokenData = argsString.slice(tokenStartIndex, tokenEndIndex);
  }

  if (!tokenData) {
    return null;
  }

  return {
    start: tokenStartIndex,
    end: tokenEndIndex,
    token: tokenData,
  };
};

export const argparse = (argsString: string) => {
  let i = 0;
  let args = [];
  let token = getToken(argsString, i);
  while (token) {
    const { end, token: tokenData } = token;
    i = end;
    args.push(tokenData);
    token = getToken(argsString, i);
  }
  return args;
};
