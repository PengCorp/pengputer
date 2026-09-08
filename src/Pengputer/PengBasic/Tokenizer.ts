/**
 * Turning one line of BASIC into tokens.
 *
 * A tokenizer is the easy half of reading a language: walk the text
 * left to right, and at each step decide what kind of thing starts
 * here from the first character alone. A digit starts a number, a
 * quote starts a string, a letter starts a word. That single lookahead
 * is all a language of this era needs.
 *
 * Three things make BASIC less tidy than that summary suggests, and
 * they are the interesting parts of this file:
 *
 *   - REM swallows the rest of the line, so the scanner has to stop
 *     being a scanner partway through a line.
 *   - DATA does the same but worse: its items are almost-raw text, so
 *     the tokenizer needs a second mode with its own rules.
 *   - Words are ambiguous. Whether PRINT is a keyword or a variable
 *     called PRINT is a decision with real consequences; see below.
 *
 * WORDS AND KEYWORDS
 *
 * Microsoft BASIC matched keywords *anywhere*, not just at word
 * boundaries. That is why "FORI=1TO10" ran: the scanner saw FOR, then
 * I, then =, then 1, then TO. It is also why a variable named SCORE
 * silently became SC OR E -- OR is a keyword, and it was found in the
 * middle of the name. Combined with names being significant to only
 * two characters, this ate a lot of afternoons in 1978.
 *
 * We match keywords only when they are the *whole* word. That is
 * forced on us by wanting long variable names -- you cannot have both
 * SCORE and keyword-anywhere -- and it is the better trade: it costs
 * "FORI=1TO10", which almost no printed listing uses, and buys back
 * every variable name that happens to contain a keyword.
 */
import { BasicError } from "./errors";
import {
    isKeyword,
    isWordOperator,
    type Operator,
    type Punct,
    type Sigil,
    type Token,
} from "./tokens";

const SIGILS = "$%!#";
const PUNCT = "(),;:";

function isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
}

/**
 * More digits than this and a constant is taken to be double
 * precision, because it was written with detail a single cannot hold.
 */
const SINGLE_DIGIT_LIMIT = 7;

/**
 * Digits that carry information: the decimal point does not, and
 * neither do zeros in front of the first real digit, so `.0001' counts
 * as one and `1000000' as seven.
 */
function significantDigits(mantissa: string): number {
    const digits = mantissa.replace(".", "").replace(/^0+/, "");
    return digits.length;
}

function isLetter(c: string): boolean {
    return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
}

function isNameChar(c: string): boolean {
    return isLetter(c) || isDigit(c) || c === ".";
}

class Tokenizer {
    private src: string;
    private pos: number = 0;
    private tokens: Token[] = [];

    constructor(src: string) {
        this.src = src;
    }

    /** The character at the cursor, or "" past the end. */
    private peek(offset: number = 0): string {
        return this.src[this.pos + offset] ?? "";
    }

    private atEnd(): boolean {
        return this.pos >= this.src.length;
    }

    private skipSpaces() {
        while (this.peek() === " " || this.peek() === "\t") this.pos += 1;
    }

    run(): Token[] {
        while (true) {
            this.skipSpaces();
            if (this.atEnd()) break;

            const start = this.pos;
            const c = this.peek();

            if (isDigit(c) || (c === "." && isDigit(this.peek(1)))) {
                this.readNumber();
            } else if (c === '"') {
                this.readString();
            } else if (isLetter(c)) {
                this.readWord();
            } else if (c === "?") {
                /* The universal abbreviation. Every listing of the era
                 * is full of it, and it is purely lexical: by the time
                 * the parser sees it, it is a PRINT like any other. */
                this.pos += 1;
                this.tokens.push({
                    kind: "keyword",
                    keyword: "PRINT",
                    pos: start,
                });
            } else if (c === "'") {
                this.pos += 1;
                this.readRemarkBody(start);
            } else if (PUNCT.includes(c)) {
                this.pos += 1;
                this.tokens.push({
                    kind: "punct",
                    punct: c as Punct,
                    pos: start,
                });
            } else {
                this.readOperator();
            }
        }

        this.tokens.push({ kind: "end", pos: this.pos });
        return this.tokens;
    }

    /**
     * 12, 1.5, .5, 5., 1E5, 1.5E-3, and their double forms 1.5#, 1.5D3.
     *
     * The exponent needs backtracking: in "1EA" the E is not an
     * exponent but the start of a variable, and we only find that out
     * after looking past it. One saved position is enough -- there is
     * no other place in the language that needs to reconsider.
     *
     * `D' marks a double-precision exponent, so `1D10' is 1E10 held to
     * sixteen digits rather than seven. It backtracks the same way, and
     * for the same reason: "1DIM" is not an exponent.
     */
    private readNumber() {
        const start = this.pos;

        while (isDigit(this.peek())) this.pos += 1;

        if (this.peek() === ".") {
            this.pos += 1;
            while (isDigit(this.peek())) this.pos += 1;
        }

        const mantissa = this.src.slice(start, this.pos);
        let isDouble = false;
        let exponent = "";

        const marker = this.peek().toUpperCase();
        if (marker === "E" || marker === "D") {
            const beforeExponent = this.pos;
            this.pos += 1;
            if (this.peek() === "+" || this.peek() === "-") this.pos += 1;

            if (isDigit(this.peek())) {
                const digitsAt = this.pos;
                while (isDigit(this.peek())) this.pos += 1;
                exponent =
                    "e" +
                    this.src.slice(beforeExponent + 1, digitsAt) +
                    this.src.slice(digitsAt, this.pos);
                if (marker === "D") isDouble = true;
            } else {
                this.pos = beforeExponent;
            }
        }

        /* An explicit suffix overrules everything; otherwise a constant
         * written with more digits than a single can carry is taken to
         * be a double, which is how you write one without saying so. */
        if (this.peek() === "#") {
            this.pos += 1;
            isDouble = true;
        } else if (this.peek() === "!") {
            this.pos += 1;
            isDouble = false;
        } else if (significantDigits(mantissa) > SINGLE_DIGIT_LIMIT) {
            isDouble = true;
        }

        this.tokens.push({
            kind: "number",
            value: Number(mantissa + exponent),
            isDouble,
            pos: start,
        });
    }

    /**
     * A quoted string.
     *
     * There are no escape sequences -- BASIC has no way at all to put a
     * double quote inside a string literal, which is why programs of
     * the era reach for CHR$(34). An unterminated string is not an
     * error either; it simply runs to the end of the line, so
     *
     *     PRINT "HELLO
     *
     * is a legal and very common thing to type.
     */
    private readString() {
        const start = this.pos;
        this.pos += 1; /* opening quote */

        const from = this.pos;
        while (!this.atEnd() && this.peek() !== '"') this.pos += 1;

        const value = this.src.slice(from, this.pos);
        if (!this.atEnd()) this.pos += 1; /* closing quote */

        this.tokens.push({ kind: "string", value, pos: start });
    }

    /** A keyword, a word operator, or a variable name. */
    private readWord() {
        const start = this.pos;
        while (isNameChar(this.peek())) this.pos += 1;

        const word = this.src.slice(start, this.pos).toUpperCase();

        if (word === "REM") {
            this.readRemarkBody(start);
            return;
        }

        if (isWordOperator(word)) {
            this.tokens.push({ kind: "operator", op: word, pos: start });
            return;
        }

        if (isKeyword(word)) {
            this.tokens.push({ kind: "keyword", keyword: word, pos: start });
            /* DATA changes how the rest of the statement is read, so
             * the keyword itself has to trigger the switch. */
            if (word === "DATA") this.readDataItems();
            return;
        }

        /* Only names take a sigil. LEFT$ arrives here as LEFT + "$",
         * and the parser recombines the two to find the built-in. */
        let sigil: Sigil = "";
        if (SIGILS.includes(this.peek())) {
            sigil = this.peek() as Sigil;
            this.pos += 1;
        }

        this.tokens.push({ kind: "name", name: word, sigil, pos: start });
    }

    /** REM and "'": everything left on the line is commentary. */
    private readRemarkBody(start: number) {
        const text = this.src.slice(this.pos);
        this.pos = this.src.length;
        this.tokens.push({ kind: "remark", text, pos: start });
    }

    /**
     * The items of a DATA statement.
     *
     * This is the one place the tokenizer has to be context-sensitive.
     * Inside DATA the usual rules are suspended: an item is whatever
     * text sits between the commas, so
     *
     *     DATA JOHN SMITH, 42, -1.5
     *
     * is three items, and the first is the string "JOHN SMITH" even
     * though nothing is quoted and it contains a space. Quoted items
     * are still honoured, which is how you keep a comma or leading
     * space in one. Surrounding whitespace on an unquoted item is
     * dropped; inside it is kept.
     *
     * Empty items are legal -- "DATA 1,,3" has three, the middle one
     * empty -- so we always read an item after a comma.
     */
    private readDataItems() {
        while (true) {
            this.skipSpaces();

            const start = this.pos;

            if (this.peek() === '"') {
                this.readString();
                const str = this.tokens.pop() as Extract<
                    Token,
                    { kind: "string" }
                >;
                this.tokens.push({
                    kind: "data",
                    value: str.value,
                    quoted: true,
                    pos: start,
                });
                this.skipSpaces();
            } else {
                while (
                    !this.atEnd() &&
                    this.peek() !== "," &&
                    this.peek() !== ":"
                ) {
                    this.pos += 1;
                }
                const raw = this.src.slice(start, this.pos);
                this.tokens.push({
                    kind: "data",
                    value: raw.trimEnd(),
                    quoted: false,
                    pos: start,
                });
            }

            if (this.peek() === ",") {
                this.pos += 1;
                continue;
            }

            /* ":" or end of line ends the statement. The ":" is left
             * for the main loop to emit as an ordinary separator. */
            return;
        }
    }

    /**
     * Symbol operators.
     *
     * The comparison operators can be written either way round --
     * "<>" and "><", "<=" and "=<" -- because Microsoft BASIC accepted
     * both, and listings use whichever the typist reached for.
     */
    private readOperator() {
        const start = this.pos;
        const c = this.peek();
        const next = this.peek(1);

        let op: Operator | null = null;

        switch (c) {
            case "+":
            case "-":
            case "*":
            case "/":
            case "^":
                op = c;
                this.pos += 1;
                break;
            case "<":
                if (next === ">") {
                    op = "<>";
                    this.pos += 2;
                } else if (next === "=") {
                    op = "<=";
                    this.pos += 2;
                } else {
                    op = "<";
                    this.pos += 1;
                }
                break;
            case ">":
                if (next === "<") {
                    op = "<>";
                    this.pos += 2;
                } else if (next === "=") {
                    op = ">=";
                    this.pos += 2;
                } else {
                    op = ">";
                    this.pos += 1;
                }
                break;
            case "=":
                if (next === "<") {
                    op = "<=";
                    this.pos += 2;
                } else if (next === ">") {
                    op = ">=";
                    this.pos += 2;
                } else {
                    op = "=";
                    this.pos += 1;
                }
                break;
            default:
                throw new BasicError("SYNTAX", start);
        }

        this.tokens.push({ kind: "operator", op, pos: start });
    }
}

/** Tokenizes one line. Throws BasicError on an illegal character. */
export function tokenize(source: string): Token[] {
    return new Tokenizer(source).run();
}
