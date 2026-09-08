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

export const KEYWORDS = [
    "LET",
    "PRINT",
    "INPUT",
    "IF",
    "THEN",
    "ELSE",
    "FOR",
    "TO",
    "STEP",
    "NEXT",
    "GOTO",
    "GOSUB",
    "RETURN",
    "ON",
    "DATA",
    "READ",
    "RESTORE",
    "DIM",
    "DEF",
    "FN",
    "END",
    "STOP",
    "CONT",
    "RUN",
    "LIST",
    "NEW",
    "CLEAR",
    "RANDOMIZE",
    "WHILE",
    "WEND",
    "USING",
    "SWAP",
    "TRON",
    "TROFF",
    "LINE",
    "RENUM",
    "AUTO",
    "DELETE",
    "EDIT",
    "CLS",
    "LOCATE",
    "COLOR",
    "DEFINT",
    "DEFSNG",
    "DEFDBL",
    "DEFSTR",
    "DELAY",
    "DOWNLOAD",
    "UPLOAD",
] as const;
export type Keyword = (typeof KEYWORDS)[number];

const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS);
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
    | { kind: "number"; value: number; pos: number }
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
