/**
 * The vocabulary the tokenizer produces.
 *
 * Two decisions here shape everything downstream.
 *
 * 1. Built-in functions are NOT keywords.
 *
 *    Microsoft BASIC reserved every function name, so you could not
 *    have a variable called LEN. We let the tokenizer emit LEN, SQR and
 *    LEFT$ as ordinary names and leave it to the parser to notice that
 *    a name is followed by "(" and look it up in a table of built-ins.
 *    Adding a function then costs one table entry and touches no
 *    lexing code at all. Only words with *grammatical* weight -- the
 *    ones that change how the rest of the line is read, like THEN or
 *    STEP -- are keywords.
 *
 * 2. AND, OR and NOT are operators, not keywords.
 *
 *    They read as words but behave as operators, and the expression
 *    parser wants them in the same bucket as "+" and "<". Emitting them
 *    as operators means precedence lives in exactly one table.
 */

/** The trailing character that gives a variable its type. */
export type Sigil = "" | "$" | "%" | "!" | "#";

/**
 * What a keyword *is*, as opposed to how it is spelled.
 *
 * Kept here, beside the keyword itself, rather than in a set belonging
 * to whoever happens to care. Anything that wants to treat control flow
 * differently from declarations -- the syntax coloring is the first,
 * and will not be the last -- asks this table instead of keeping its own
 * copy, which is the arrangement that cannot drift.
 */
export type KeywordKind =
    /** Moves the program counter, or bounds a block: IF, FOR, GOTO, END. */
    | "control"
    /** Declares something: DIM, DEF, CONST, DEFINT -- and DATA. */
    | "declaration"
    /** Does something: PRINT, CLS, SWAP, and the prompt's own commands. */
    | "command";

export const KEYWORDS = {
    LET: "declaration",
    PRINT: "command",
    INPUT: "command",
    IF: "control",
    THEN: "control",
    ELSE: "control",
    ELSEIF: "control",
    SELECT: "control",
    CASE: "control",
    IS: "control",
    DO: "control",
    LOOP: "control",
    UNTIL: "control",
    EXIT: "control",
    FOR: "control",
    TO: "control",
    STEP: "control",
    NEXT: "control",
    GOTO: "control",
    GOSUB: "control",
    RETURN: "control",
    ON: "control",
    DATA: "declaration",
    READ: "command",
    RESTORE: "command",
    DIM: "declaration",
    ERASE: "declaration",
    REDIM: "declaration",
    CONST: "declaration",
    OPTION: "declaration",
    BASE: "declaration",
    ERROR: "control",
    RESUME: "control",
    DEF: "declaration",
    FN: "declaration",
    END: "control",
    STOP: "control",
    CONT: "command",
    RUN: "command",
    LIST: "command",
    NEW: "command",
    CLEAR: "command",
    RANDOMIZE: "command",
    WHILE: "control",
    WEND: "control",
    USING: "command",
    SWAP: "command",
    TRON: "command",
    TROFF: "command",
    LINE: "command",
    RENUM: "command",
    AUTO: "command",
    DELETE: "command",
    EDIT: "command",
    CLS: "command",
    LOCATE: "command",
    COLOR: "command",
    DEFINT: "declaration",
    DEFSNG: "declaration",
    DEFDBL: "declaration",
    DEFSTR: "declaration",
    DELAY: "command",
    DOWNLOAD: "command",
    UPLOAD: "command",
} as const satisfies Record<string, KeywordKind>;

export type Keyword = keyof typeof KEYWORDS;

export function keywordKind(keyword: Keyword): KeywordKind {
    return KEYWORDS[keyword];
}

const KEYWORD_SET: ReadonlySet<string> = new Set(Object.keys(KEYWORDS));
export function isKeyword(word: string): word is Keyword {
    return KEYWORD_SET.has(word);
}

/** Word-shaped operators, kept apart from keywords on purpose. */
export const WORD_OPERATORS = ["AND", "OR", "NOT"] as const;
export type WordOperator = (typeof WORD_OPERATORS)[number];

const WORD_OPERATOR_SET: ReadonlySet<string> = new Set(WORD_OPERATORS);
export function isWordOperator(word: string): word is WordOperator {
    return WORD_OPERATOR_SET.has(word);
}

export const OPERATORS = [
    "+",
    "-",
    "*",
    "/",
    "^",
    "=",
    "<>",
    "<",
    ">",
    "<=",
    ">=",
    ...WORD_OPERATORS,
] as const;
export type Operator = (typeof OPERATORS)[number];

/** Structural characters. ":" separates statements on one line. */
export type Punct = "(" | ")" | "," | ";" | ":";

export type Token =
    /**
     * `isDouble' is decided here rather than later because it is a
     * property of how the constant was *written*: `1.5' is a single and
     * `1.5#' is a double, and by the time the parser sees a plain
     * number that difference is gone.
     */
    | { kind: "number"; value: number; isDouble: boolean; pos: number }
    | { kind: "string"; value: string; pos: number }
    | { kind: "name"; name: string; sigil: Sigil; pos: number }
    | { kind: "keyword"; keyword: Keyword; pos: number }
    | { kind: "operator"; op: Operator; pos: number }
    | { kind: "punct"; punct: Punct; pos: number }
    /** REM or "'". Carries the text so LIST can reproduce it. */
    | { kind: "remark"; text: string; pos: number }
    /** One item of a DATA statement, already separated from its commas. */
    | { kind: "data"; value: string; quoted: boolean; pos: number }
    /** Sentinel, so the parser can always look at a token. */
    | { kind: "end"; pos: number };

/** A name and its sigil as one string: how built-ins are keyed. */
export function nameWithSigil(token: Extract<Token, { kind: "name" }>): string {
    return token.name + token.sigil;
}
