/**
 * The shapes an expression can take.
 *
 * Two things are deliberately absent.
 *
 * No positions. Tokens carry a `pos' because a *syntax* error can point
 * at a character, but BASIC reports runtime errors per line -- `?TYPE
 * MISMATCH ERROR IN 100', never a column -- so an expression tree that
 * only ever runs has nothing to do with one.
 *
 * No distinction between an array subscript and a function call. See
 * the note on `call' below; it is the interesting problem in this
 * stage.
 */
import type { Sigil } from "./tokens";

export type BinaryOp =
    | "+" | "-" | "*" | "/" | "^"
    | "=" | "<>" | "<" | ">" | "<=" | ">="
    | "AND" | "OR";

export type UnaryOp = "-" | "NOT";

export type Expr =
    | { kind: "number"; value: number }
    | { kind: "string"; value: string }
    | { kind: "variable"; name: string; sigil: Sigil }
    /**
     * `NAME(args)'.
     *
     * In BASIC a call and a subscript are written identically -- `A(1)'
     * is the second element of array A, and `SQR(1)' is a function --
     * and nothing in the *syntax* tells them apart. Only what the name
     * refers to does, which is not known until the program runs and its
     * arrays exist. So the parser does not guess: it emits one node for
     * both, and the evaluator resolves it by looking in the built-in
     * table first and the arrays second.
     *
     * This is how the original worked too, and it is why in Microsoft
     * BASIC you could not have an array called LEN.
     */
    | { kind: "call"; name: string; sigil: Sigil; args: Expr[] }
    /**
     * `FNA(3)'. Separate from `call' because a user function is never
     * ambiguous with an array -- the FN prefix says what it is.
     */
    | { kind: "fnCall"; name: string; sigil: Sigil; argument: Expr }
    | { kind: "unary"; op: UnaryOp; operand: Expr }
    | { kind: "binary"; op: BinaryOp; left: Expr; right: Expr };

/* ------------------------------------------------------------------ */

/** Somewhere a value can be stored: a scalar, or one array element. */
export type LValue =
    | { kind: "variable"; name: string; sigil: Sigil }
    | { kind: "element"; name: string; sigil: Sigil; subscripts: Expr[] };

/**
 * The pieces of a PRINT.
 *
 * The separators are items in their own right rather than punctuation
 * between items, because in BASIC they *do* something: a comma moves to
 * the next 14-column zone and a semicolon deliberately does not move at
 * all. `PRINT ,,,X' is three zone jumps and is perfectly meaningful.
 */
export type PrintItem =
    | { kind: "expression"; expr: Expr }
    | { kind: "tab"; expr: Expr }
    | { kind: "spc"; expr: Expr }
    | { kind: "zone" }
    | { kind: "adjacent" };

/** `DEF FN A(X) = X*X'. One parameter: that is all 8K allowed. */
export interface FnDefinition {
    name: string;
    sigil: Sigil;
    parameter: { name: string; sigil: Sigil };
    body: Expr;
}

export interface LetterRange {
    from: string;
    to: string;
}

export interface DataItem {
    value: string;
    quoted: boolean;
}

export interface DimEntry {
    name: string;
    sigil: Sigil;
    bounds: Expr[];
}

/** A FOR loop's counter. Always a scalar -- never an array element. */
export interface LoopVariable {
    name: string;
    sigil: Sigil;
}

export type Statement =
    | { kind: "let"; target: LValue; value: Expr }
    | { kind: "goto"; line: number }
    | { kind: "gosub"; line: number }
    | { kind: "return" }
    /**
     * Everything after THEN to the end of the line is the then-branch,
     * and everything after ELSE is the else-branch. `IF X THEN A: B'
     * runs *both* A and B only when X is true -- the colon does not end
     * the IF, which catches people out constantly.
     */
    | { kind: "if"; condition: Expr; then: Statement[]; else: Statement[] | null }
    | { kind: "for"; variable: LoopVariable; from: Expr; to: Expr; step: Expr | null }
    /** `NEXT', `NEXT I' or `NEXT I,J'. Empty list means the innermost. */
    | { kind: "next"; variables: LoopVariable[] }
    | { kind: "on"; selector: Expr; target: "goto" | "gosub"; lines: number[] }
    | { kind: "stop" }
    | { kind: "cont" }
    | { kind: "while"; condition: Expr }
    | { kind: "wend" }
    | { kind: "swap"; left: LValue; right: LValue }
    /**
     * `INPUT "NAME"; A$, B'.
     *
     * `showQuestionMark' is false when the prompt was separated with a
     * comma instead of a semicolon -- the one place in BASIC where those
     * two mean something genuinely different.
     */
    | {
          kind: "input";
          prompt: string;
          showQuestionMark: boolean;
          targets: LValue[];
      }
    /** `LINE INPUT "PROMPT"; A$'. One string, commas and all. */
    | { kind: "lineInput"; prompt: string; target: LValue }
    /** Items are raw text; READ decides what they mean. */
    | { kind: "data"; items: DataItem[] }
    | { kind: "read"; targets: LValue[] }
    | { kind: "restore"; line: number | null }
    | { kind: "defFn"; definition: FnDefinition }
    | { kind: "randomize"; seed: Expr | null }
    | { kind: "delete"; from: number | null; to: number | null }
    /** `RENUM [new][,[old][,increment]]'. Omitted parts take defaults. */
    | {
          kind: "renum";
          newStart: number | null;
          oldStart: number | null;
          increment: number | null;
      }
    | { kind: "auto"; start: number | null; increment: number | null }
    | { kind: "edit"; line: number }
    | { kind: "cls" }
    /**
     * `DELAY 50' -- wait that many milliseconds.
     *
     * Not a Microsoft statement. Programs of the era paced themselves
     * with `FOR I=1 TO 500: NEXT', which finishes instantly here, and
     * there is no honest way to make a JavaScript interpreter as slow
     * as a 2MHz 6502 by accident.
     */
    | { kind: "delay"; milliseconds: Expr }
    /** Both one-based, as BASIC counts. Either may be left out. */
    | { kind: "locate"; row: Expr | null; column: Expr | null }
    | { kind: "color"; foreground: Expr | null; background: Expr | null }
    /** `DEFINT A-Z' -- the default type for names starting with those letters. */
    | { kind: "defType"; suffix: "%" | "!" | "#" | "$"; ranges: LetterRange[] }
    /** `PRINT USING "###.##"; A, B'. Commas here are just separators. */
    | { kind: "printUsing"; format: Expr; values: Expr[]; newline: boolean }
    /**
     * `MID$(A$,n[,m]) = B$' -- an assignment *into* a string, which
     * never changes its length. The one statement that looks like a
     * function call on the left of an "=".
     */
    | {
          kind: "midAssign";
          target: LValue;
          start: Expr;
          length: Expr | null;
          value: Expr;
      }
    | { kind: "trace"; on: boolean }
    /** `newline' is false when the statement ended in "," or ";". */
    | { kind: "print"; items: PrintItem[]; newline: boolean }
    | { kind: "remark"; text: string }
    | { kind: "dim"; entries: DimEntry[] }
    | { kind: "end" }
    | { kind: "run" }
    | { kind: "list"; from: number | null; to: number | null }
    | { kind: "new" }
    | { kind: "clear" };
