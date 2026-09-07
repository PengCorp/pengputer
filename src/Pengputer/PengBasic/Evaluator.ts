/**
 * Working out what an expression is worth.
 *
 * A tree walk: ask each child for its value, combine. The interesting
 * content is not the recursion, it is BASIC's type rules, which are
 * stricter than almost anything modern.
 *
 *   - Nothing converts implicitly. `"1" + 1' is `?TYPE MISMATCH ERROR',
 *     not "11" and not 2.
 *   - `+' is the only operator that means two things: add two numbers,
 *     or join two strings. A mixture is an error.
 *   - `- * / ^' are numbers only.
 *   - Comparisons take two numbers or two strings, never one of each,
 *     and return a *number*: -1 for true, 0 for false.
 *   - AND, OR and NOT are bitwise on 16-bit integers, not boolean. This
 *     is why true is -1 rather than 1 -- all sixteen bits set, so `NOT'
 *     turns it back into 0 and the logical reading falls out for free.
 *
 * WHERE `A(1)' IS DECIDED
 *
 * The parser refused to guess whether that was an array or a function,
 * because the syntax genuinely does not say. It is settled here, and
 * the order is: built-in first, array second. That reproduces the
 * original's behaviour, where function names were effectively reserved
 * and an array called LEN was simply not available to you.
 */
import { BasicError } from "./errors";
import type { BinaryOp, Expr, FnDefinition } from "./ast";
import type { Variables } from "./Variables";
import {
    type Value,
    asNumber,
    asString,
    checkOverflow,
    checkStringLength,
    fromBoolean,
    toInt16,
} from "./values";

export interface Builtin {
    minArgs: number;
    maxArgs: number;
    call(args: Value[]): Value;
}

/** Keyed by name plus sigil, e.g. "LEN" and "LEFT$". Filled in stage 7. */
export type Builtins = ReadonlyMap<string, Builtin>;

/** Keyed by name plus sigil, filled in by DEF FN as the program runs. */
export type UserFunctions = ReadonlyMap<string, FnDefinition>;

export class Evaluator {
    private variables: Variables;
    private builtins: Builtins;
    private functions: UserFunctions;

    constructor(
        variables: Variables,
        builtins: Builtins = new Map(),
        functions: UserFunctions = new Map(),
    ) {
        this.variables = variables;
        this.builtins = builtins;
        this.functions = functions;
    }

    evaluate(expr: Expr): Value {
        switch (expr.kind) {
            case "number":
                return expr.value;

            case "string":
                return expr.value;

            case "variable": {
                /* RND on its own is a call, not a variable -- and so
                 * will TIMER and INKEY$ be. Anything the table lists as
                 * taking no arguments may be written bare. */
                const builtin = this.builtins.get(expr.name + expr.sigil);
                if (builtin && builtin.minArgs === 0) return builtin.call([]);
                return this.variables.getScalar(expr.name, expr.sigil);
            }

            case "call":
                return this.evaluateCall(expr);

            case "fnCall":
                return this.evaluateFnCall(expr);

            case "unary":
                return this.evaluateUnary(expr);

            case "binary":
                return this.evaluateBinary(expr);
        }
    }

    private evaluateCall(expr: Extract<Expr, { kind: "call" }>): Value {
        const args = expr.args.map((arg) => this.evaluate(arg));

        const builtin = this.builtins.get(expr.name + expr.sigil);
        if (builtin) {
            if (args.length < builtin.minArgs || args.length > builtin.maxArgs) {
                throw new BasicError("SYNTAX");
            }
            return builtin.call(args);
        }

        return this.variables.getElement(
            expr.name,
            expr.sigil,
            args.map((arg) => asNumber(arg)),
        );
    }

    /**
     * A user function.
     *
     * The parameter is an ordinary variable, temporarily holding the
     * argument. Its previous value is put back afterwards, so `DEF
     * FNA(X)' does not quietly clobber a global X the program is using
     * for something else -- and restoring rather than scoping is also
     * what makes a recursive definition not corrupt itself.
     */
    private evaluateFnCall(expr: Extract<Expr, { kind: "fnCall" }>): Value {
        const definition = this.functions.get(expr.name + expr.sigil);
        if (!definition) throw new BasicError("UNDEF'D FUNCTION");

        const { parameters } = definition;
        if (expr.args.length !== parameters.length) {
            throw new BasicError("SYNTAX");
        }

        /* Arguments are worked out before any binding happens, so a
         * call like FNA(X, FNA(1, 2)) sees the caller's X rather than a
         * half-applied set of parameters. */
        const args = expr.args.map((arg) => this.evaluate(arg));
        const saved = parameters.map((parameter) =>
            this.variables.getScalar(parameter.name, parameter.sigil),
        );

        parameters.forEach((parameter, index) => {
            this.variables.setScalar(parameter.name, parameter.sigil, args[index]);
        });
        try {
            return this.evaluate(definition.body);
        } finally {
            parameters.forEach((parameter, index) => {
                this.variables.setScalar(
                    parameter.name,
                    parameter.sigil,
                    saved[index],
                );
            });
        }
    }

    private evaluateUnary(expr: Extract<Expr, { kind: "unary" }>): Value {
        const operand = this.evaluate(expr.operand);

        if (expr.op === "-") return checkOverflow(-asNumber(operand));

        /* NOT is bitwise: NOT n is -(n+1). */
        return ~toInt16(operand);
    }

    private evaluateBinary(expr: Extract<Expr, { kind: "binary" }>): Value {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        return applyBinary(expr.op, left, right);
    }
}

export function applyBinary(op: BinaryOp, left: Value, right: Value): Value {
    switch (op) {
        case "+":
            /* The one overloaded operator. Two strings join; two
             * numbers add; a mixture is an error rather than a
             * conversion. */
            if (typeof left === "string" || typeof right === "string") {
                return checkStringLength(asString(left) + asString(right));
            }
            return checkOverflow(left + right);

        case "-":
            return checkOverflow(asNumber(left) - asNumber(right));

        case "*":
            return checkOverflow(asNumber(left) * asNumber(right));

        case "/": {
            const divisor = asNumber(right);
            if (divisor === 0) throw new BasicError("DIVISION BY ZERO");
            return checkOverflow(asNumber(left) / divisor);
        }

        case "^": {
            const result = Math.pow(asNumber(left), asNumber(right));
            /* A negative base to a fractional power has no real value. */
            if (Number.isNaN(result)) throw new BasicError("ILLEGAL QUANTITY");
            return checkOverflow(result);
        }

        case "AND":
            return toInt16(left) & toInt16(right);

        case "OR":
            return toInt16(left) | toInt16(right);

        default:
            return compare(op, left, right);
    }
}

/**
 * Comparisons.
 *
 * Both sides must be the same kind. Strings compare by character code,
 * so "A" < "B" and "Z" < "a", which is the ASCII ordering the original
 * had and the reason sorting routines in listings are all upper case.
 */
function compare(
    op: "=" | "<>" | "<" | ">" | "<=" | ">=",
    left: Value,
    right: Value,
): number {
    const leftIsString = typeof left === "string";
    if (leftIsString !== (typeof right === "string")) {
        throw new BasicError("TYPE MISMATCH");
    }

    let ordering: number;
    if (leftIsString) {
        const a = asString(left);
        const b = asString(right);
        ordering = a < b ? -1 : a > b ? 1 : 0;
    } else {
        const a = asNumber(left);
        const b = asNumber(right);
        ordering = a < b ? -1 : a > b ? 1 : 0;
    }

    switch (op) {
        case "=":
            return fromBoolean(ordering === 0);
        case "<>":
            return fromBoolean(ordering !== 0);
        case "<":
            return fromBoolean(ordering < 0);
        case ">":
            return fromBoolean(ordering > 0);
        case "<=":
            return fromBoolean(ordering <= 0);
        case ">=":
            return fromBoolean(ordering >= 0);
    }
}
