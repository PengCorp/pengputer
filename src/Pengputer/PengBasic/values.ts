/**
 * What a BASIC expression can be worth, and the rules for converting.
 *
 * There are exactly two kinds of value -- a number or a string -- and
 * BASIC converts between them almost never. `A = "X"' is not a
 * coercion, it is `?TYPE MISMATCH ERROR'. The only place the two meet
 * is `+', which adds numbers and joins strings and refuses a mixture.
 *
 * The four *types* below are a separate idea from the two kinds of
 * value: they are what a variable's sigil declares about it, which
 * decides what may be stored and how it is narrowed on the way in.
 */
import { BasicError } from "./errors";
import type { Sigil } from "./tokens";

export type Value = number | string;

export type BasicType = "single" | "double" | "integer" | "string";

/** Largest magnitude a Microsoft single could hold. */
export const MAX_SINGLE = 1.7014118e38;

export const MAX_STRING_LENGTH = 255;

export const MIN_INTEGER = -32768;
export const MAX_INTEGER = 32767;

/**
 * The sigil decides the type -- and note that no sigil and "!" mean the
 * same thing, because single precision is the default. `A' and `A!' are
 * one variable; `A%', `A$' and `A#' are three others.
 */
export function typeOfSigil(sigil: Sigil): BasicType {
    switch (sigil) {
        case "$":
            return "string";
        case "%":
            return "integer";
        case "#":
            return "double";
        case "!":
        case "":
            return "single";
    }
}

/** The canonical suffix for a type, used to key variable storage. */
export function suffixOfType(type: BasicType): string {
    switch (type) {
        case "string":
            return "$";
        case "integer":
            return "%";
        case "double":
            return "#";
        case "single":
            return "!";
    }
}

export function defaultValue(type: BasicType): Value {
    return type === "string" ? "" : 0;
}

/**
 * Rounds a number to what a 32-bit float can actually hold.
 *
 * This is the whole of single precision. A Microsoft single had a
 * 24-bit mantissa, which is about seven decimal digits, and the machine
 * did every default-typed sum in exactly that -- so `.1' was never one
 * tenth, and adding it ten times did not give one. `Math.fround' is the
 * same 24-bit mantissa, so applying it wherever the original would have
 * stored a single reproduces the original's arithmetic bit for bit,
 * drift included.
 *
 * Everything in JavaScript is a double already, which is why doing
 * nothing here was silently *more* accurate than a real machine -- and
 * why the sample runs printed in books did not match.
 */
export function toSingle(n: number): number {
    return Math.fround(n);
}

/**
 * Which of two numeric types an operation between them produces.
 *
 * Widest wins, and the order is integer, single, double: an integer
 * plus a single is a single, and anything touching a double is a
 * double. This is what stops one `#' value halfway down an expression
 * from being rounded away by the singles around it.
 */
export function widerNumericType(a: BasicType, b: BasicType): BasicType {
    if (a === "double" || b === "double") return "double";
    if (a === "single" || b === "single") return "single";
    return "integer";
}

/**
 * Applies a numeric type's precision to a value.
 *
 * Distinct from `coerceToType': that narrows a value on its way *into*
 * a variable and may reject it, while this one is about the width an
 * intermediate result was computed at.
 */
export function roundToType(n: number, type: BasicType): number {
    return type === "double" ? n : toSingle(n);
}

export function isStringValue(value: Value): value is string {
    return typeof value === "string";
}

/** A number, or `?TYPE MISMATCH ERROR'. */
export function asNumber(value: Value): number {
    if (typeof value !== "number") throw new BasicError("TYPE MISMATCH");
    return value;
}

/** A string, or `?TYPE MISMATCH ERROR'. */
export function asString(value: Value): string {
    if (typeof value !== "string") throw new BasicError("TYPE MISMATCH");
    return value;
}

/** Anything bigger than a single could hold is `?OVERFLOW ERROR'. */
export function checkOverflow(n: number, type: BasicType = "single"): number {
    /* Integer arithmetic is sixteen bits wide and overflows *there*,
     * not when the answer is finally stored -- `A%+B%' is `?OVERFLOW'
     * even when what it gets assigned to could have held the result.
     * The range is asymmetric, so it cannot go through the magnitude
     * test the other two use. */
    if (type === "integer") {
        if (!Number.isFinite(n) || n < MIN_INTEGER || n > MAX_INTEGER) {
            throw new BasicError("OVERFLOW");
        }
        return n;
    }

    const limit = type === "double" ? Number.MAX_VALUE : MAX_SINGLE;
    if (!Number.isFinite(n) || Math.abs(n) > limit) {
        throw new BasicError("OVERFLOW");
    }
    return n;
}

export function checkStringLength(s: string): string {
    if (s.length > MAX_STRING_LENGTH) throw new BasicError("STRING TOO LONG");
    return s;
}

/**
 * Rounds to an integer, half away from zero.
 *
 * Not `Math.round`, which breaks ties towards +Infinity and so is
 * asymmetric: it sends 2.5 to 3 but -2.5 to -2. A machine of this era
 * converted by taking the magnitude, adding a half and truncating, then
 * reapplying the sign -- which is symmetric, and gives -3.
 *
 * The zero normalization matters too: `Math.round(-0.2)` is -0, and -0
 * survives arithmetic invisibly until something prints it as "-0".
 */
export function roundToInteger(n: number): number {
    const rounded = n < 0 ? -Math.round(-n) : Math.round(n);
    return rounded === 0 ? 0 : rounded;
}

/**
 * Narrows a value on its way into a variable of the given type.
 *
 * Assigning to an integer *rounds* rather than truncating -- `A% = 2.7'
 * leaves 3, while `INT(2.7)' is 2. The two are easy to conflate and
 * they are genuinely different operations.
 */
export function coerceToType(value: Value, type: BasicType): Value {
    if (type === "string") return checkStringLength(asString(value));

    const n = asNumber(value);
    if (type === "double") return checkOverflow(n, "double");

    /* A single-precision variable does not merely hold a rounded
     * number, it holds a 32-bit float -- so the rounding happens here,
     * on the way in, and every later read gives the rounded value. */
    if (type === "single") return checkOverflow(toSingle(n));

    const rounded = roundToInteger(n);
    if (rounded < MIN_INTEGER || rounded > MAX_INTEGER) {
        throw new BasicError("OVERFLOW");
    }
    return rounded;
}

/**
 * The 16-bit integer AND, OR and NOT operate on.
 *
 * They are bitwise, not boolean, which is *why* true is -1: all sixteen
 * bits set. `NOT 0' is -1 and `NOT -1' is 0, so the logical reading
 * falls out of the bitwise one for the two values comparisons produce.
 */
export function toInt16(value: Value): number {
    const rounded = roundToInteger(asNumber(value));
    if (rounded < MIN_INTEGER || rounded > MAX_INTEGER) {
        throw new BasicError("OVERFLOW");
    }
    return rounded;
}

/** BASIC's booleans: -1 and 0, as ordinary numbers. */
export function fromBoolean(b: boolean): number {
    return b ? -1 : 0;
}
