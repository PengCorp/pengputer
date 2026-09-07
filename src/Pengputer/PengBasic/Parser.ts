/**
 * Parsing expressions.
 *
 * The parser's job is to turn a flat list of tokens into a tree that
 * says what groups with what. `2+3*4' and `(2+3)*4' are the same five
 * tokens in the same order; only the tree tells them apart.
 *
 * THE METHOD
 *
 * One function per precedence level, each calling the next-tighter one
 * and looping on its own operators:
 *
 *     parseOr         -> OR                    (loosest)
 *     parseAnd        -> AND
 *     parseNot        -> NOT                   (unary)
 *     parseComparison -> =  <>  <  >  <=  >=
 *     parseAddition   -> +  -
 *     parseTerm       -> *  /
 *     parseUnary      -> -  +                  (unary)
 *     parsePower      -> ^                     (tightest)
 *     parsePrimary    -> numbers, strings, names, ( ... )
 *
 * The cascade *is* the precedence table from the design notes, written
 * out as code. Nothing else in this file knows about precedence, so
 * changing the table means reordering these calls and nothing more.
 *
 * Looping rather than recursing on the operator gives left
 * associativity: `10-3-2' comes out as `(10-3)-2', which is 5, not
 * `10-(3-2)', which is 9.
 *
 * TWO PLACES BASIC IS NOT WHAT YOU EXPECT
 *
 * Unary minus binds *looser* than `^', so `-2^2' is -(2^2) = -4, not
 * (-2)^2 = 4. That is why parseUnary sits between parseTerm and
 * parsePower rather than down next to the primaries.
 *
 * Comparisons are ordinary operators returning ordinary numbers -- -1
 * for true, 0 for false -- so they sit in the cascade like arithmetic
 * does, and `A = B AND C = D' groups the way you would want without
 * anything special. Book programs lean on the numeric result: `X = X -
 * (A > B)' adds one to X when A exceeds B.
 */
import { BasicError } from "./errors";
import { tokenize } from "./Tokenizer";
import type { Expr } from "./ast";
import type { Operator, Punct, Token } from "./tokens";

export class Parser {
    protected tokens: Token[];
    protected pos: number;

    constructor(tokens: Token[], pos: number = 0) {
        this.tokens = tokens;
        this.pos = pos;
    }

    /* ---------- cursor ---------- */

    /** Never runs off the end: the token list always ends in "end". */
    protected peek(): Token {
        return this.tokens[Math.min(this.pos, this.tokens.length - 1)];
    }

    protected getPosition(): number {
        return this.pos;
    }

    protected takeOperator<T extends Operator>(...ops: T[]): T | null {
        const token = this.peek();
        if (token.kind !== "operator") return null;
        if (!(ops as readonly Operator[]).includes(token.op)) return null;
        this.pos += 1;
        return token.op as T;
    }

    protected takePunct(punct: Punct): boolean {
        const token = this.peek();
        if (token.kind !== "punct" || token.punct !== punct) return false;
        this.pos += 1;
        return true;
    }

    protected expectPunct(punct: Punct) {
        if (!this.takePunct(punct)) throw new BasicError("SYNTAX", this.peek().pos);
    }

    /** Throws unless everything has been consumed. */
    expectEnd() {
        const token = this.peek();
        if (token.kind !== "end") throw new BasicError("SYNTAX", token.pos);
    }

    /* ---------- the cascade ---------- */

    parseExpression(): Expr {
        return this.parseOr();
    }

    private parseOr(): Expr {
        let left = this.parseAnd();
        while (this.takeOperator("OR")) {
            left = { kind: "binary", op: "OR", left, right: this.parseAnd() };
        }
        return left;
    }

    private parseAnd(): Expr {
        let left = this.parseNot();
        while (this.takeOperator("AND")) {
            left = { kind: "binary", op: "AND", left, right: this.parseNot() };
        }
        return left;
    }

    private parseNot(): Expr {
        if (this.takeOperator("NOT")) {
            return { kind: "unary", op: "NOT", operand: this.parseNot() };
        }
        return this.parseComparison();
    }

    private parseComparison(): Expr {
        let left = this.parseAddition();
        for (;;) {
            const op = this.takeOperator("=", "<>", "<", ">", "<=", ">=");
            if (op === null) return left;
            left = { kind: "binary", op, left, right: this.parseAddition() };
        }
    }

    private parseAddition(): Expr {
        let left = this.parseTerm();
        for (;;) {
            const op = this.takeOperator("+", "-");
            if (op === null) return left;
            left = { kind: "binary", op, left, right: this.parseTerm() };
        }
    }

    private parseTerm(): Expr {
        let left = this.parseUnary();
        for (;;) {
            const op = this.takeOperator("*", "/");
            if (op === null) return left;
            left = { kind: "binary", op, left, right: this.parseUnary() };
        }
    }

    private parseUnary(): Expr {
        const op = this.takeOperator("-", "+");
        if (op === "-") {
            return { kind: "unary", op: "-", operand: this.parseUnary() };
        }
        if (op === "+") {
            /* A leading plus is allowed and means nothing. */
            return this.parseUnary();
        }
        return this.parsePower();
    }

    /**
     * `^', left associative: 2^3^2 is (2^3)^2 = 64.
     *
     * Left rather than right because that is what the original did --
     * its evaluator reduced a pending operator as soon as it met one of
     * equal precedence -- and not because it is the usual convention in
     * mathematics, where it is right associative and would give 512.
     *
     * The right-hand side goes through parsePowerOperand rather than
     * parsePrimary so that `2^-3' works: a sign is allowed straight
     * after the operator even though unary minus is otherwise looser
     * than `^'. Routing it back through parsePower instead would quietly
     * make the operator right associative again.
     */
    private parsePower(): Expr {
        let left = this.parsePrimary();
        while (this.takeOperator("^")) {
            left = {
                kind: "binary",
                op: "^",
                left,
                right: this.parsePowerOperand(),
            };
        }
        return left;
    }

    private parsePowerOperand(): Expr {
        const op = this.takeOperator("-", "+");
        if (op === "-") {
            return { kind: "unary", op: "-", operand: this.parsePowerOperand() };
        }
        if (op === "+") return this.parsePowerOperand();
        return this.parsePrimary();
    }

    private parsePrimary(): Expr {
        const token = this.peek();

        switch (token.kind) {
            case "number":
                this.pos += 1;
                return { kind: "number", value: token.value };

            case "string":
                this.pos += 1;
                return { kind: "string", value: token.value };

            case "name": {
                this.pos += 1;
                const next = this.peek();
                if (next.kind === "punct" && next.punct === "(") {
                    const fnName = userFunctionName(token.name);
                    if (fnName !== null) {
                        const args = this.parseArguments();
                        if (args.length !== 1) {
                            throw new BasicError("SYNTAX", token.pos);
                        }
                        return {
                            kind: "fnCall",
                            name: fnName,
                            sigil: token.sigil,
                            argument: args[0],
                        };
                    }
                    return {
                        kind: "call",
                        name: token.name,
                        sigil: token.sigil,
                        args: this.parseArguments(),
                    };
                }
                return { kind: "variable", name: token.name, sigil: token.sigil };
            }

            case "punct":
                if (token.punct === "(") {
                    this.pos += 1;
                    const inner = this.parseExpression();
                    this.expectPunct(")");
                    return inner;
                }
                break;
        }

        throw new BasicError("SYNTAX", token.pos);
    }

    /** `(a, b, c)'. At least one argument; `A()' is a syntax error. */
    protected parseArguments(): Expr[] {
        this.expectPunct("(");
        const args: Expr[] = [this.parseExpression()];
        while (this.takePunct(",")) args.push(this.parseExpression());
        this.expectPunct(")");
        return args;
    }
}

/**
 * The name of the user function `FNx' refers to, or null if this is an
 * ordinary name.
 *
 * Microsoft wrote `DEF FNA(X)' and called it as `FNA(3)', so `FNA' has
 * to come apart into FN + A. We refused leading-keyword splitting in
 * general (§11.3) because it wrecks names like TOTAL, but FN is a
 * narrow, well-signposted carve-out — and we can be *less* damaging
 * than the original by requiring the "(" too. A variable called FNAME
 * still works; only `FNAME(...)' would be misread, and MS mangled that
 * either way.
 */
export function userFunctionName(name: string): string | null {
    if (name.length <= 2) return null;
    if (!name.startsWith("FN")) return null;
    return name.slice(2);
}

/** Parses a whole line as a single expression. Throws on anything left over. */
export function parseExpression(source: string): Expr {
    const parser = new Parser(tokenize(source));
    const expr = parser.parseExpression();
    parser.expectEnd();
    return expr;
}
