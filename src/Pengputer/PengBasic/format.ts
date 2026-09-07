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
 *   - About six significant digits, trailing zeros stripped.
 *   - A leading zero is dropped: one half prints as ".5", not "0.5".
 *   - Outside roughly 0.01 to 999999 it switches to "1.23457E+12".
 */

/** A comma in PRINT moves to the next multiple of this. */
export const PRINT_ZONE_WIDTH = 14;

const SIGNIFICANT_DIGITS = 6;

export function formatValue(value: number | string): string {
    return typeof value === "string" ? value : formatNumber(value);
}

export function formatNumber(n: number): string {
    const sign = n < 0 ? "-" : " ";
    return sign + formatMagnitude(Math.abs(n)) + " ";
}

/**
 * What STR$ gives: the same as PRINT, minus the trailing space. The
 * leading sign position stays, so STR$(1) is " 1".
 */
export function formatNumberForStr(n: number): string {
    return (n < 0 ? "-" : " ") + formatMagnitude(Math.abs(n));
}

function formatMagnitude(n: number): string {
    if (n === 0) return "0";

    const exponent = Math.floor(Math.log10(n));
    if (exponent >= SIGNIFICANT_DIGITS || exponent < -2) {
        return scientific(n);
    }

    const fixed = trimZeros(n.toPrecision(SIGNIFICANT_DIGITS));

    /* Rounding can push a value over the edge -- 999999.5 rounds to
     * 1000000, which no longer fits the fixed form. */
    if (fixed.includes("e") || fixed.includes("E")) return scientific(n);

    return dropLeadingZero(fixed);
}

function scientific(n: number): string {
    const [mantissa, exponent] = n.toExponential(SIGNIFICANT_DIGITS - 1).split("e");
    const power = Number(exponent);
    const sign = power < 0 ? "-" : "+";
    return `${trimZeros(mantissa)}E${sign}${String(Math.abs(power)).padStart(2, "0")}`;
}

function trimZeros(s: string): string {
    if (!s.includes(".")) return s;
    return s.replace(/0+$/, "").replace(/\.$/, "");
}

function dropLeadingZero(s: string): string {
    return s.startsWith("0.") ? s.slice(1) : s;
}
