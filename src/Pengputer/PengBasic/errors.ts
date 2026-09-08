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
    | "UNDEF'D FUNCTION"
    | "RESUME WITHOUT ERROR"
    | "DUPLICATE DEFINITION"
    | "LOOP WITHOUT DO"
    | "ARRAY NOT DEFINED"
    /* What `ERROR n' gives for a code with no message of its own. */
    | "UNPRINTABLE";

/**
 * Microsoft's error numbers, which `ERR' reports and `ERROR n' raises.
 *
 * The numbers are not ours to choose: a program that says `IF ERR=11'
 * means division by zero and nothing else, so this table is the
 * interface between our error names and every listing ever written.
 * Codes with no entry here are ones we cannot raise -- 14 is out of
 * string space, 16 a formula too complex -- and `ERROR 14' therefore
 * gives `?UNPRINTABLE ERROR' rather than pretending.
 */
const ERROR_CODES: ReadonlyMap<BasicErrorKind, number> = new Map([
    ["NEXT WITHOUT FOR", 1],
    /* Not in Microsoft's classic numbering -- it is a QuickBASIC-era
     * construct, and there it is caught at compile time, where an error
     * has no number at all. Sharing SYNTAX's code keeps `ERR' sensible;
     * the reverse lookup below still resolves 2 to SYNTAX because this
     * entry comes first. */
    ["LOOP WITHOUT DO", 2],
    ["SYNTAX", 2],
    ["RETURN WITHOUT GOSUB", 3],
    ["OUT OF DATA", 4],
    ["ILLEGAL QUANTITY", 5],
    ["OVERFLOW", 6],
    ["OUT OF MEMORY", 7],
    ["UNDEF'D STATEMENT", 8],
    /* QuickBASIC's wording, for a QuickBASIC-only function. Its own
     * number is unknown -- it is caught at compile time there, where an
     * error has none -- so it shares the code for the nearest classic
     * error, a bad array reference. SUBSCRIPT OUT OF RANGE still owns
     * the reverse lookup because it comes second. */
    ["ARRAY NOT DEFINED", 9],
    ["SUBSCRIPT OUT OF RANGE", 9],
    /* Both are error 10 in Microsoft's numbering -- a name being given
     * a size or a value it already has. `ERROR 10' resolves to the
     * array one, which is the older and far commoner of the two. */
    ["DUPLICATE DEFINITION", 10],
    ["REDIM'D ARRAY", 10],
    ["DIVISION BY ZERO", 11],
    ["TYPE MISMATCH", 13],
    ["STRING TOO LONG", 15],
    ["CAN'T CONTINUE", 17],
    ["UNDEF'D FUNCTION", 18],
    ["RESUME WITHOUT ERROR", 20],
    ["WHILE WITHOUT WEND", 29],
    ["WEND WITHOUT WHILE", 30],
]);

const KINDS_BY_CODE: ReadonlyMap<number, BasicErrorKind> = new Map(
    [...ERROR_CODES].map(([kind, code]) => [code, kind]),
);

/** What `ERROR n' raises: the named error, or an unprintable one. */
export function errorKindForCode(code: number): BasicErrorKind {
    return KINDS_BY_CODE.get(code) ?? "UNPRINTABLE";
}

/*
 * Every message is `?<KIND> ERROR' except the one whose name already
 * ends in the word -- "?RESUME WITHOUT ERROR", not "?RESUME WITHOUT
 * ERROR ERROR".
 */
function messageFor(kind: BasicErrorKind): string {
    return kind.endsWith("ERROR") ? `?${kind}` : `?${kind} ERROR`;
}

export class BasicError extends Error {
    readonly kind: BasicErrorKind;

    /** Index into the source line, or null if not tied to one spot. */
    readonly pos: number | null;

    /**
     * What `ERR' reports. Normally derived from the kind, but `ERROR n'
     * can raise a number we have no name for, and that number still has
     * to survive to the handler that asked for it.
     */
    readonly code: number;

    constructor(
        kind: BasicErrorKind,
        pos: number | null = null,
        code: number | null = null,
    ) {
        super(messageFor(kind));
        this.name = "BasicError";
        this.kind = kind;
        this.pos = pos;
        this.code = code ?? ERROR_CODES.get(kind) ?? 0;
    }

    /** The text BASIC prints, with the line number when there is one. */
    format(line: number | null = null): string {
        const text = messageFor(this.kind);
        return line === null ? text : `${text} IN ${line}`;
    }
}

export function isBasicError(e: unknown): e is BasicError {
    return e instanceof BasicError;
}
