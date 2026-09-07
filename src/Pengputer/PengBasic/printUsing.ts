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
 * `_` prints the next character literally, so a format can contain a
 * `#` of its own.
 *
 * Not implemented: `^^^^` exponential fields. Rare in listings, fiddly
 * to get right, and nothing has wanted one yet.
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

    /* One pass per go round the format; stop when the values run out. */
    do {
        for (const piece of pieces) {
            if (piece.kind === "literal") {
                out += piece.text;
                continue;
            }
            if (index >= values.length) return out;

            const value = values[index];
            index += 1;
            out +=
                piece.kind === "numeric"
                    ? renderNumeric(piece, asNumber(value))
                    : renderString(piece, asString(value));
        }
    } while (index < values.length);

    return out;
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

    const dollar = format.startsWith("$$", at);
    if (dollar) at += 2;

    const asterisk = format.startsWith("**", at);
    if (asterisk) at += 2;

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
            width,
        },
        next: at,
    };
}

function renderNumeric(field: NumericField, value: number): string {
    const negative = value < 0;
    const magnitude = Math.abs(value);

    let digits = field.hasDecimal
        ? magnitude.toFixed(field.digitsAfter)
        : String(Math.round(magnitude));

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
