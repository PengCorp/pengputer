/**
 * Errors, in the shape Microsoft BASIC reported them.
 *
 * Every error is `?<KIND> ERROR', and when one happens while a program
 * is running rather than at the prompt, ` IN <line>' is appended:
 *
 *     ?SYNTAX ERROR IN 100
 *
 * The line number is not known down here -- the tokenizer has no idea
 * which line it was handed -- so a BasicError carries only the position
 * within the line, and whoever is running the program adds the rest.
 */

export type BasicErrorKind =
    | "SYNTAX"
    | "TYPE MISMATCH"
    | "ILLEGAL QUANTITY"
    | "OVERFLOW"
    | "DIVISION BY ZERO"
    | "OUT OF DATA"
    | "UNDEF'D STATEMENT"
    | "NEXT WITHOUT FOR"
    | "RETURN WITHOUT GOSUB"
    | "SUBSCRIPT OUT OF RANGE"
    | "REDIM'D ARRAY"
    | "STRING TOO LONG"
    | "OUT OF MEMORY"
    | "CAN'T CONTINUE"
    | "WHILE WITHOUT WEND"
    | "WEND WITHOUT WHILE"
    | "UNDEF'D FUNCTION";

export class BasicError extends Error {
    readonly kind: BasicErrorKind;

    /** Index into the source line, or null if not tied to one spot. */
    readonly pos: number | null;

    constructor(kind: BasicErrorKind, pos: number | null = null) {
        super(`?${kind} ERROR`);
        this.name = "BasicError";
        this.kind = kind;
        this.pos = pos;
    }

    /** The text BASIC prints, with the line number when there is one. */
    format(line: number | null = null): string {
        return line === null ? `?${this.kind} ERROR` : `?${this.kind} ERROR IN ${line}`;
    }
}

export function isBasicError(e: unknown): e is BasicError {
    return e instanceof BasicError;
}
