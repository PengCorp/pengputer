/**
 * PRINT USING.
 *
 * A format string is scanned for *fields*; everything that is not a
 * field is copied out literally. Each field consumes one value.
 *
 *     PRINT USING "###.##"; 3.14159      ->    3.14
 *     PRINT USING "TOTAL: $$#,###.##"; 1234.5   ->  TOTAL:  $1,234.50
 *     PRINT USING "!"; "PENGER"          ->  P
 *
 * If there are more values than fields the format starts over, which is
 * how a program prints a whole table from one format. If a number will
 * not fit its field it is printed in full with a leading `%`, so the
 * output is wrong-looking rather than quietly truncated -- a good
 * instinct, and one worth keeping.
 *
 * Numeric fields
 *   #     a digit position
 *   .     the decimal point
 *   ,     group the integer part in threes (written before the point)
 *   +     print the sign always, leading or trailing
 *   -     trailing only: a minus for negatives, a space otherwise
 *   $$    a currency sign that floats up against the first digit
 *   **    fill the unused positions with asterisks
 *
 * String fields
 *   !         the first character
 *   \   \     a field as wide as the backslashes and the gap between
 *   &         the string entire, however long
 *
 *   ^^^^      show the value as a mantissa and an exponent
 *
 * `_` prints the next character literally, so a format can contain a
 * `#` of its own.
 *
 * Everything here except one rounding edge is checked line for line
 * against a real GW-BASIC.
 */
import { BasicError } from "./errors";
import { formatNumberForStr } from "./format";
import { asNumber, asString, type Value } from "./values";

interface NumericField {
    kind: "numeric";
    digitsBefore: number;
    digitsAfter: number;
    hasDecimal: boolean;
    grouped: boolean;
    leadingSign: boolean;
    trailingSign: boolean;
    trailingMinus: boolean;
    dollar: boolean;
    asterisk: boolean;
    /** `^^^^' -- show the value as a mantissa and an exponent. */
    exponential: boolean;
    width: number;
}

interface StringField {
    kind: "string";
    width: number;
    /** `&` takes the string whole, whatever its length. */
    variable: boolean;
}

type Piece = { kind: "literal"; text: string } | NumericField | StringField;

export function printUsing(format: string, values: Value[]): string {
    const pieces = parseFormat(format);

    if (!pieces.some((piece) => piece.kind !== "literal")) {
        /* A format with no fields at all would loop forever. */
        throw new BasicError("ILLEGAL QUANTITY");
    }

    let out = "";
    let index = 0;

    /*
     * Literal text is held back until a field actually takes a value.
     *
     * Output stops dead at the field that finds nothing left, and the
     * literal leading up to it is never printed: `PRINT USING "## ##";1'
     * ends after the 1, without the space that follows the first field.
     * Held text carries across a go round the format, which is what
     * makes `PRINT USING "##;";1,2,3' put a semicolon between each pair
     * and one on the end.
     */
    let pending = "";

    do {
        for (const piece of pieces) {
            if (piece.kind === "literal") {
                pending += piece.text;
                continue;
            }
            if (index >= values.length) return out;

            out += pending;
            pending = "";

            const value = values[index];
            index += 1;
            out +=
                piece.kind === "numeric"
                    ? renderNumeric(piece, asNumber(value))
                    : renderString(piece, asString(value));
        }
    } while (index < values.length);

    /* Everything after the last field, now that every value is placed. */
    return out + pending;
}

function parseFormat(format: string): Piece[] {
    const pieces: Piece[] = [];
    let literal = "";
    let at = 0;

    const flushLiteral = () => {
        if (literal.length > 0) {
            pieces.push({ kind: "literal", text: literal });
            literal = "";
        }
    };

    while (at < format.length) {
        const char = format[at];

        /* An underscore quotes whatever follows it. */
        if (char === "_" && at + 1 < format.length) {
            literal += format[at + 1];
            at += 2;
            continue;
        }

        if (char === "!") {
            flushLiteral();
            pieces.push({ kind: "string", width: 1, variable: false });
            at += 1;
            continue;
        }

        if (char === "&") {
            flushLiteral();
            pieces.push({ kind: "string", width: 0, variable: true });
            at += 1;
            continue;
        }

        /* \   \ -- width is the two slashes plus whatever sits between. */
        if (char === "\\") {
            const close = format.indexOf("\\", at + 1);
            const gap = format.slice(at + 1, close < 0 ? format.length : close);
            if (close >= 0 && !/[^ ]/.test(gap)) {
                flushLiteral();
                pieces.push({
                    kind: "string",
                    width: gap.length + 2,
                    variable: false,
                });
                at = close + 1;
                continue;
            }
        }

        const numeric = parseNumericField(format, at);
        if (numeric !== null) {
            flushLiteral();
            pieces.push(numeric.field);
            at = numeric.next;
            continue;
        }

        literal += char;
        at += 1;
    }

    flushLiteral();
    return pieces;
}

function parseNumericField(
    format: string,
    start: number,
): { field: NumericField; next: number } | null {
    let at = start;

    /*
     * `**$' is one prefix meaning both -- asterisk fill *and* a floating
     * currency sign -- and it has to be tried before either half, or the
     * `**' matches on its own and leaves a stray `$' behind as literal
     * text. That was the bug: `**$##.##' parsed as a two-wide field, a
     * literal dollar, and a second field, so `PRINT USING "**$##.##";12.3'
     * printed `12$' and then stopped for want of a second value.
     */
    let dollar = false;
    let asterisk = false;
    if (format.startsWith("**$", at)) {
        dollar = true;
        asterisk = true;
        at += 3;
    } else if (format.startsWith("$$", at)) {
        dollar = true;
        at += 2;
    } else if (format.startsWith("**", at)) {
        asterisk = true;
        at += 2;
    }

    const leadingSign = format[at] === "+";
    if (leadingSign) at += 1;

    let digitsBefore = 0;
    let grouped = false;
    while (at < format.length) {
        if (format[at] === "#") {
            digitsBefore += 1;
            at += 1;
        } else if (format[at] === "," && format[at + 1] === "#") {
            grouped = true;
            at += 1;
        } else break;
    }

    /* $$ and ** stand in for digit positions of their own. */
    if (dollar) digitsBefore += 2;
    if (asterisk) digitsBefore += 2;

    let digitsAfter = 0;
    let hasDecimal = false;
    if (format[at] === "." && format[at + 1] === "#") {
        hasDecimal = true;
        at += 1;
        while (format[at] === "#") {
            digitsAfter += 1;
            at += 1;
        }
    }

    if (digitsBefore === 0 && !hasDecimal) return null;

    /*
     * Exactly four carets, and only four: a fifth is literal text. They
     * stand for the `E+nn' that follows the mantissa, and they are four
     * characters wide because that is how wide `E+nn' is.
     */
    const exponential = format.startsWith("^^^^", at);
    if (exponential) at += 4;

    const trailingSign = format[at] === "+";
    if (trailingSign) at += 1;
    const trailingMinus = !trailingSign && format[at] === "-";
    if (trailingMinus) at += 1;

    /* The field is as wide as the characters it occupies in the format.
     * Counting digit positions instead gets grouping wrong, because the
     * commas in "#,###,###" are part of the width too. */
    const width = at - start;

    return {
        field: {
            kind: "numeric",
            digitsBefore,
            digitsAfter,
            hasDecimal,
            grouped,
            leadingSign,
            trailingSign,
            trailingMinus,
            dollar,
            asterisk,
            exponential,
            width,
        },
        next: at,
    };
}

/**
 * The mantissa and exponent an `^^^^' field shows.
 *
 * How many digits the mantissa gets before its point is the whole of
 * this, and it is one *fewer* than there are digit positions -- because
 * one of them is the sign's. Writing an explicit `+' gives the sign a
 * position of its own and hands the digit back, which is why
 * `##.##^^^^' shows 1234 as `1.23E+03' and `+##.##^^^^' shows the same
 * number as `+12.34E+02'.
 *
 * With one position and no decimals there is nowhere to put a mantissa
 * at all, and `#^^^^' of 1234 is a bare `E+04'.
 */
function exponentialDigits(field: NumericField, magnitude: number): string {
    const signHasItsOwn =
        field.leadingSign || field.trailingSign || field.trailingMinus;
    const before = Math.max(0, field.digitsBefore - (signHasItsOwn ? 0 : 1));

    if (magnitude === 0) {
        const zero =
            before === 0 && !field.hasDecimal
                ? ""
                : (0).toFixed(field.digitsAfter);
        return `${zero}E+00`;
    }

    let power = Math.floor(Math.log10(magnitude)) - before + 1;
    let mantissa = magnitude / 10 ** power;

    /* Rounding the mantissa can push it up a decimal place -- 9.99 shown
     * to one place is 10.0 -- which is one digit too many. */
    let shown = mantissa.toFixed(field.digitsAfter);
    if (shown.replace(/\..*$/, "").replace(/^0+/, "").length > before) {
        power += 1;
        mantissa = magnitude / 10 ** power;
        shown = mantissa.toFixed(field.digitsAfter);
    }

    if (before === 0 && !field.hasDecimal) shown = "";

    const sign = power < 0 ? "-" : "+";
    const size = String(Math.abs(power)).padStart(2, "0");
    return `${shown}E${sign}${size}`;
}

function renderNumeric(field: NumericField, value: number): string {
    const negative = value < 0;
    const magnitude = Math.abs(value);

    let digits = field.exponential
        ? exponentialDigits(field, magnitude)
        : field.hasDecimal
          ? magnitude.toFixed(field.digitsAfter)
          : String(Math.round(magnitude));

    /*
     * `.##' asks for no integer digits at all, and a value below one has
     * none to show: 0.5 is `.50', not an overflow. A value that *does*
     * have an integer part still overflows, which is the point of asking
     * for none.
     */
    if (
        !field.exponential &&
        field.digitsBefore === 0 &&
        digits.startsWith("0.")
    ) {
        digits = digits.slice(1);
    }

    if (field.grouped) digits = groupThousands(digits);

    let sign = "";
    if (field.leadingSign || field.trailingSign) sign = negative ? "-" : "+";
    else if (field.trailingMinus) sign = negative ? "-" : " ";
    else if (negative) sign = "-";

    const signTrails = field.trailingSign || field.trailingMinus;
    const leading = signTrails ? "" : sign;
    const trailing = signTrails ? sign : "";
    const body = (field.dollar ? "$" : "") + digits;

    /* Too wide to fit: print it all, flagged, rather than quietly lie
     * about the value. */
    const used = leading.length + body.length + trailing.length;
    if (used > field.width) return `%${leading}${body}${trailing}`;

    const fill = field.asterisk ? "*" : " ";
    return fill.repeat(field.width - used) + leading + body + trailing;
}

function renderString(field: StringField, value: string): string {
    if (field.variable) return value;
    return value.slice(0, field.width).padEnd(field.width);
}

function groupThousands(digits: string): string {
    const [whole, fraction] = digits.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** Exposed so STR$ and PRINT agree about what a number looks like. */
export { formatNumberForStr };
