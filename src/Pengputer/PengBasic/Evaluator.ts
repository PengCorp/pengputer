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
    type BasicType,
    type Value,
    asNumber,
    asString,
    checkOverflow,
    checkStringLength,
    fromBoolean,
    roundToType,
    toInt16,
    widerNumericType,
} from "./values";

export interface Builtin {
    minArgs: number;
    maxArgs: number;
    /** What width the answer comes back at. See `Typed'. */
    resultType: BasicType;
    /**
     * Arguments arrive with their widths attached, because a few
     * functions need them -- STR$ has to know whether it is showing six
     * digits or sixteen. Most do not care and unwrap with the `num' and
     * `str' helpers in the table.
     */
    call(args: Typed[]): Value;
}

/**
 * A value together with the width it was computed at.
 *
 * The interpreter needs both because single precision is not a
 * property of the number -- every number here is a JavaScript double —
 * it is a property of the *expression*. `A! * B!' and `A# * B#' can
 * hold the same bits and still have to round differently, so the type
 * travels alongside the value rather than being recovered from it.
 */
export interface Typed {
    value: Value;
    type: BasicType;
}

/** The type of a value, when nothing better is known about it. */
function typeOfValue(value: Value): BasicType {
    return typeof value === "string" ? "string" : "single";
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

    /** The value alone, for the many callers that do not care how wide it is. */
    evaluate(expr: Expr): Value {
        return this.evaluateTyped(expr).value;
    }

    evaluateTyped(expr: Expr): Typed {
        switch (expr.kind) {
            case "number":
                return {
                    value: expr.value,
                    type: expr.isDouble ? "double" : "single",
                };

            case "string":
                return { value: expr.value, type: "string" };

            case "variable": {
                /* RND on its own is a call, not a variable -- and so
                 * will TIMER and INKEY$ be. Anything the table lists as
                 * taking no arguments may be written bare. */
                const builtin = this.builtins.get(expr.name + expr.sigil);
                if (builtin && builtin.minArgs === 0) {
                    return {
                        value: builtin.call([]),
                        type: builtin.resultType,
                    };
                }
                return {
                    value: this.variables.getScalar(expr.name, expr.sigil),
                    type: this.variables.getType(expr.name, expr.sigil),
                };
            }

            case "call":
                return this.evaluateCall(expr);

            case "fnCall":
                return this.evaluateFnCall(expr);

            case "arrayBound": {
                const dimension =
                    expr.dimension === null
                        ? 1
                        : Math.trunc(asNumber(this.evaluate(expr.dimension)));
                return {
                    value: this.variables.bound(
                        expr.name,
                        expr.sigil,
                        expr.which,
                        dimension,
                    ),
                    type: "integer",
                };
            }

            case "unary":
                return this.evaluateUnary(expr);

            case "binary":
                return this.evaluateBinary(expr);
        }
    }

    private evaluateCall(expr: Extract<Expr, { kind: "call" }>): Typed {
        const args = expr.args.map((arg) => this.evaluateTyped(arg));

        const builtin = this.builtins.get(expr.name + expr.sigil);
        if (builtin) {
            if (
                args.length < builtin.minArgs ||
                args.length > builtin.maxArgs
            ) {
                throw new BasicError("SYNTAX");
            }
            const result = builtin.call(args);
            /* The library was single precision on the original -- SQR
             * and SIN and the rest all went through the same
             * accumulator as everything else -- so a result declared
             * single is rounded like one. */
            return {
                value: this.narrow(result, builtin.resultType),
                type: builtin.resultType,
            };
        }

        return {
            value: this.variables.getElement(
                expr.name,
                expr.sigil,
                args.map((arg) => asNumber(arg.value)),
            ),
            type: this.variables.getType(expr.name, expr.sigil),
        };
    }

    /** Applies a type's width to a value, leaving strings alone. */
    private narrow(value: Value, type: BasicType): Value {
        if (typeof value === "string") return value;
        return roundToType(value, type);
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
    private evaluateFnCall(expr: Extract<Expr, { kind: "fnCall" }>): Typed {
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
            this.variables.setScalar(
                parameter.name,
                parameter.sigil,
                args[index],
            );
        });
        try {
            /* The function's own sigil decides the width it answers at,
             * exactly as it would for a variable of that name. */
            const type = this.variables.getType(expr.name, expr.sigil);
            return {
                value: this.narrow(this.evaluate(definition.body), type),
                type,
            };
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

    private evaluateUnary(expr: Extract<Expr, { kind: "unary" }>): Typed {
        const operand = this.evaluateTyped(expr.operand);

        if (expr.op === "-") {
            /* Negation cannot lose precision, so the operand's own type
             * carries straight through. */
            return {
                value: checkOverflow(-asNumber(operand.value), operand.type),
                type: operand.type,
            };
        }

        /* NOT is bitwise: NOT n is -(n+1). */
        return { value: ~toInt16(operand.value), type: "integer" };
    }

    private evaluateBinary(expr: Extract<Expr, { kind: "binary" }>): Typed {
        const left = this.evaluateTyped(expr.left);
        const right = this.evaluateTyped(expr.right);
        const type = resultType(expr.op, left.type, right.type);
        return {
            value: applyBinary(expr.op, left.value, right.value, type),
            type,
        };
    }
}

/**
 * The width an operation answers at, from the widths going in.
 *
 * Three rules, and they are the whole of BASIC's numeric promotion:
 *
 *   - Comparisons and the bitwise operators always answer an integer,
 *     whatever they were given. `A# = B#' is -1 or 0, not a double.
 *   - `+' on strings answers a string; on numbers it promotes.
 *   - Division and exponentiation never answer an integer, because
 *     `1/3' and `2^-1' are not integers. Everything else takes the
 *     wider of its operands.
 */
function resultType(
    op: BinaryOp,
    left: BasicType,
    right: BasicType,
): BasicType {
    switch (op) {
        case "=":
        case "<>":
        case "<":
        case ">":
        case "<=":
        case ">=":
        case "AND":
        case "OR":
            return "integer";

        case "+":
            if (left === "string" || right === "string") return "string";
            return widerNumericType(left, right);

        case "/":
        case "^":
            return widerNumericType(widerNumericType(left, right), "single");

        default:
            return widerNumericType(left, right);
    }
}

/**
 * `type' is the width the operation answers at, and it does two jobs:
 * it sets the limit an overflow is measured against, and it is what the
 * result is rounded to. Rounding here rather than only on assignment is
 * the point of the whole exercise -- the original machine rounded every
 * intermediate, so `A*B+C' in single precision rounds twice, and a sum
 * that never touches a variable still drifts.
 */
export function applyBinary(
    op: BinaryOp,
    left: Value,
    right: Value,
    type: BasicType = "single",
): Value {
    const narrow = (n: number) => roundToType(checkOverflow(n, type), type);

    switch (op) {
        case "+":
            /* The one overloaded operator. Two strings join; two
             * numbers add; a mixture is an error rather than a
             * conversion. */
            if (typeof left === "string" || typeof right === "string") {
                return checkStringLength(asString(left) + asString(right));
            }
            return narrow(left + right);

        case "-":
            return narrow(asNumber(left) - asNumber(right));

        case "*":
            return narrow(asNumber(left) * asNumber(right));

        case "/": {
            const divisor = asNumber(right);
            if (divisor === 0) throw new BasicError("DIVISION BY ZERO");
            return narrow(asNumber(left) / divisor);
        }

        case "^": {
            const result = Math.pow(asNumber(left), asNumber(right));
            /* A negative base to a fractional power has no real value. */
            if (Number.isNaN(result)) throw new BasicError("ILLEGAL QUANTITY");
            return narrow(result);
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
