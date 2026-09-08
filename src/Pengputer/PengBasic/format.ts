/**
 * Turning values into the text BASIC prints.
 *
 * This is the most visible authenticity detail in the whole
 * interpreter. Get it wrong and every program looks subtly off at a
 * glance, even though the arithmetic is right.
 *
 * The rules:
 *
 *   - Every number gets a **sign position** in front -- "-" if
 *     negative, a space if not -- and a **trailing space**. `PRINT 1'
 *     emits " 1 ", which is why columns of numbers in listings line up
 *     without anyone doing anything.
 *   - About six significant digits, trailing zeros stripped -- or
 *     sixteen for a double, which is why every entry point here takes
 *     the value's type.
 *   - A leading zero is dropped: one half prints as ".5", not "0.5".
 *   - Outside roughly 0.01 to 999999 it switches to "1.23457E+12", and
 *     a double uses "D" where a single uses "E".
 */

import type { BasicType } from "./values";

/** A comma in PRINT moves to the next multiple of this. */
export const PRINT_ZONE_WIDTH = 14;

const SINGLE_DIGITS = 7;
const DOUBLE_DIGITS = 16;

/**
 * How a number is shown depends on how wide it is.
 *
 * A single gets six digits and an `E' exponent; a double gets sixteen
 * and a `D' one, which is how you could tell the two apart on a printed
 * listing. The marker is not decoration -- `1.5E10' and `1.5D10' are
 * different constants, and the output uses the same spelling as the
 * input.
 */
interface Precision {
    digits: number;
    marker: string;
}

function precisionOf(type: BasicType): Precision {
    return type === "double"
        ? { digits: DOUBLE_DIGITS, marker: "D" }
        : { digits: SINGLE_DIGITS, marker: "E" };
}

export function formatValue(
    value: number | string,
    type: BasicType = "single",
): string {
    return typeof value === "string" ? value : formatNumber(value, type);
}

export function formatNumber(n: number, type: BasicType = "single"): string {
    const sign = n < 0 ? "-" : " ";
    return sign + formatMagnitude(Math.abs(n), precisionOf(type)) + " ";
}

/**
 * What STR$ gives: the same as PRINT, minus the trailing space. The
 * leading sign position stays, so STR$(1) is " 1".
 */
export function formatNumberForStr(
    n: number,
    type: BasicType = "single",
): string {
    return (
        (n < 0 ? "-" : " ") + formatMagnitude(Math.abs(n), precisionOf(type))
    );
}

function formatMagnitude(n: number, precision: Precision): string {
    if (n === 0) return "0";

    const exponent = Math.floor(Math.log10(n));
    if (exponent >= precision.digits || exponent < -2) {
        return scientific(n, precision);
    }

    const fixed = trimZeros(n.toPrecision(precision.digits));

    /* Rounding can push a value over the edge -- 999999.5 rounds to
     * 1000000, which no longer fits the fixed form. */
    if (fixed.includes("e") || fixed.includes("E")) {
        return scientific(n, precision);
    }

    return dropLeadingZero(fixed);
}

function scientific(n: number, precision: Precision): string {
    const [mantissa, exponent] = n
        .toExponential(precision.digits - 1)
        .split("e");
    const power = Number(exponent);
    const sign = power < 0 ? "-" : "+";
    return `${trimZeros(mantissa)}${precision.marker}${sign}${String(Math.abs(power)).padStart(2, "0")}`;
}

function trimZeros(s: string): string {
    if (!s.includes(".")) return s;
    return s.replace(/0+$/, "").replace(/\.$/, "");
}

function dropLeadingZero(s: string): string {
    return s.startsWith("0.") ? s.slice(1) : s;
}
