import { PengTerm } from "../PengTerm";
import { ControlCharacter } from "../PengTerm/ControlCharacters";
import { charArray } from "../types";

const flushN = (term: PengTerm, n: number) => {
  for (let i = 0; i < n; i += 1) {
    term.sendBuffer.shift();
  }
};

/**
 * Returns either a character or an escape sequence from term.
 *
 * On successful read the read buffer is consumed.
 */
export const readTerm = (term: PengTerm): charArray | undefined => {
  const result = [];
  let readIndex = 0;
  const buf = term.sendBuffer;

  if (buf.length === 0) {
    return undefined;
  }

  let nextChar = buf[readIndex++];

  if (nextChar === ControlCharacter.SS3) {
    result.push(nextChar);
    nextChar = buf[readIndex++];
    if (nextChar === undefined) {
      return undefined;
    }
    result.push(nextChar);
    flushN(term, result.length);
    return result;
  }

  if (nextChar === ControlCharacter.ESC) {
    result.push(nextChar);
    nextChar = buf[readIndex++];
    if (nextChar === "?" || nextChar === "[") {
      result.push(nextChar);
      nextChar = buf[readIndex++];
    }
    if (nextChar === undefined) {
      return undefined;
    }
    result.push(nextChar);
    flushN(term, result.length);
    return result;
  }

  // CR/LF handling
  if (nextChar === ControlCharacter.CR) {
    nextChar = buf[readIndex++];
    if (nextChar === undefined) {
      flushN(term, 1);
      return [ControlCharacter.CR];
    }
    if (nextChar === ControlCharacter.LF) {
      flushN(term, 2);
      return [ControlCharacter.LF];
    }
    flushN(term, 1);
    return [ControlCharacter.CR];
  }

  flushN(term, 1);
  return [nextChar];
};
