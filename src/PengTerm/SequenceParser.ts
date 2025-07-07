import { charArray, char } from "../types";
import { ControlCharacter } from "./ControlCharacters";

const CANCELLING_CHARACTERS: char[] = [
  ControlCharacter.ESC,
  ControlCharacter.CSI,
  ControlCharacter.CAN,
  ControlCharacter.SUB,
];
const getIsCancellingCharacter = (char: char) => {
  return CANCELLING_CHARACTERS.includes(char);
};

const getIsNumericCharacter = (char: char) => {
  return char >= "0" && char <= "9";
};

export interface Sequence {
  escapedCharacter?: string;

  csiCharacter?: string;
  csiNumericParameters?: number[];
}

export class SequenceParser {
  public inProgress: boolean = false;
  public isCancelled: boolean = false;

  private buffer: charArray = [];
  private bufferIndex: number = 0;

  private numericParameters: number[] | null = null;

  constructor() {}

  private parseNumericParameters() {
    const numericChars = [];
    while (
      getIsNumericCharacter(this.peekCharacter()) ||
      this.peekCharacter() === ";"
    ) {
      numericChars.push(this.takeCharacter());
    }

    return numericChars
      .join("")
      .split(";")
      .map((n) => (n.length > 0 ? Number(n) : 0));
  }

  private parseEscapeSequence(): Sequence | null {
    const ch = this.takeCharacter();

    if (ch === undefined) {
      return null;
    }

    if (ch === "[") {
      return this.parseCsiSequence();
    }

    return {
      escapedCharacter: ch,
    };
  }

  private parseCsiSequence(): Sequence | null {
    const numeric = this.parseNumericParameters();

    const ch = this.takeCharacter();

    if (ch === undefined) {
      return null;
    }

    return {
      csiCharacter: ch,
      csiNumericParameters: numeric,
    };
  }

  private takeCharacter(
    isInitialCharacter: boolean = false
  ): string | undefined {
    if (this.isCancelled) return undefined;
    const ch = this.buffer[this.bufferIndex];
    if (!isInitialCharacter && getIsCancellingCharacter(ch)) {
      this.isCancelled = true;
      return undefined;
    }
    if (ch !== undefined) {
      this.bufferIndex += 1;
    }
    return ch;
  }

  private peekCharacter() {
    return this.buffer[this.bufferIndex];
  }

  parse(buffer: charArray): Sequence | null {
    this.buffer = buffer;
    this.bufferIndex = 0;
    this.inProgress = true;
    this.isCancelled = false;

    let result: Sequence | null = null;

    const ch = this.takeCharacter(true);
    if (ch === ControlCharacter.ESC) {
      result = this.parseEscapeSequence();
    } else if (ch === ControlCharacter.CSI) {
      result = this.parseCsiSequence();
    } else if (ch !== undefined) {
    }

    if (result || this.isCancelled) {
      buffer.splice(0, this.bufferIndex);
      this.inProgress = false;
    }

    return result;
  }
}
