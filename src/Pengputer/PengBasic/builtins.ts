/**
 * The built-in function library.
 *
 * Every entry is one row in a table, which is the payoff for the
 * decision back in §11.4 to keep function names out of the keyword list
 * and §12.3 to let the parser emit one node for both calls and
 * subscripts: adding a function touches neither the tokenizer nor the
 * parser.
 *
 * Names are keyed with their sigil, so `LEFT$` is the key and the `$`
 * is part of it -- which is also how the evaluator tells `MID$` the
 * function from `MID` the array.
 *
 * A function with `minArgs: 0` may be written without parentheses at
 * all: `RND` on its own means `RND(1)`.
 */
import { BasicError } from "./errors";
import { characterForCode, codeForCharacter } from "./cp437";
import { splitStringIntoCharacters } from "@Toolbox/String";
import { formatNumberForStr } from "./format";
import type { Builtin, Builtins, Typed } from "./Evaluator";
import type { Console } from "./console";
import type { Random } from "./random";
import {
    type BasicType,
    asNumber,
    coerceToType,
    asString,
    checkOverflow,
    checkStringLength,
    toInt16,
    toSingle,
    type Value,
} from "./values";

/** Reported by FRE. Cosmetic, and matches the startup banner. */
const FREE_BYTES = 61440;

export interface BuiltinDependencies {
    machine: Console;
    random: Random;
    /** Injected so the clock functions can be tested. */
    now: () => Date;
}

export function createBuiltins(deps: BuiltinDependencies): Builtins {
    const table = new Map<string, Builtin>();

    /**
     * `resultType' is the width the answer comes back at, and it
     * matters: a function declared single gets its result rounded to a
     * 32-bit float, exactly as the original library did. A `$' on the
     * name settles it, so only the integer-valued functions have to say
     * so explicitly.
     */
    const define = (
        name: string,
        minArgs: number,
        maxArgs: number,
        call: (args: Typed[]) => Value,
        resultType: BasicType = name.endsWith("$") ? "string" : "single",
    ) => {
        table.set(name, { minArgs, maxArgs, resultType, call });
    };

    /* ---------------- numeric ---------------- */

    define("ABS", 1, 1, (a) => Math.abs(num(a[0])));
    define("SGN", 1, 1, (a) => Math.sign(num(a[0])));

    /**
     * INT rounds *down*, always -- INT(-2.5) is -3, not -2. It is not
     * the same operation as storing into an integer variable, which
     * rounds to nearest (§13.2).
     */
    define("INT", 1, 1, (a) => Math.floor(num(a[0])));

    /**
     * FIX truncates *toward zero*, which is INT for positives and one
     * away from it for negatives: INT(-2.4) is -3, FIX(-2.4) is -2.
     * Listings use whichever one gives the rounding they want, and the
     * two are only distinguishable below zero.
     */
    define("FIX", 1, 1, (a) => Math.trunc(num(a[0])));

    /* ---- conversions between the numeric widths ---- */

    /**
     * CINT rounds to the nearest whole number and insists it fit in
     * sixteen bits -- the same narrowing an assignment to a `%'
     * variable does, available as an expression.
     */
    define("CINT", 1, 1, (a) => coerceToType(num(a[0]), "integer"), "integer");

    /**
     * CSNG throws away the digits a single cannot hold; CDBL keeps
     * every digit there is. Neither changes the number, only the width
     * the interpreter treats it at -- which is enough to change how it
     * prints and how it rounds from here on.
     */
    define("CSNG", 1, 1, (a) => toSingle(num(a[0])), "single");
    define("CDBL", 1, 1, (a) => num(a[0]), "double");

    define("SQR", 1, 1, (a) => {
        const x = num(a[0]);
        if (x < 0) throw new BasicError("ILLEGAL QUANTITY");
        return Math.sqrt(x);
    });

    define("SIN", 1, 1, (a) => Math.sin(num(a[0])));
    define("COS", 1, 1, (a) => Math.cos(num(a[0])));
    define("TAN", 1, 1, (a) => Math.tan(num(a[0])));
    define("ATN", 1, 1, (a) => Math.atan(num(a[0])));

    define("EXP", 1, 1, (a) => checkOverflow(Math.exp(num(a[0]))));

    define("LOG", 1, 1, (a) => {
        const x = num(a[0]);
        if (x <= 0) throw new BasicError("ILLEGAL QUANTITY");
        return Math.log(x);
    });

    /* See random.ts for why the sign of the argument matters. */
    define("RND", 0, 1, (a) => {
        const x = a.length === 0 ? 1 : num(a[0]);
        if (x < 0) {
            deps.random.seed(x);
            return deps.random.next();
        }
        return x === 0 ? deps.random.repeat() : deps.random.next();
    });

    define("FRE", 0, 1, () => FREE_BYTES, "integer");

    /** The column PRINT would write to next, counting from 1. */
    define("POS", 0, 1, () => deps.machine.getColumn() + 1, "integer");
    define("CSRLIN", 0, 0, () => deps.machine.getCursorRow() + 1, "integer");

    /* ---------------- the machine ---------------- */

    /**
     * A key if one is waiting, "" if not. Never waits -- which is the
     * whole point, and the difference between a game loop and INPUT.
     */
    define("INKEY$", 0, 1, () => deps.machine.readKey());

    /**
     * SCREEN(row, col) -- the code of the character at that cell,
     * counting from 1. How a text-mode game reads its own screen back
     * to find out what it is about to run into.
     */
    define(
        "SCREEN",
        2,
        2,
        (a) => {
            const row = positionArgument(a[0].value);
            const column = positionArgument(a[1].value);
            return codeForCharacter(
                deps.machine.readCharacter(row - 1, column - 1),
            );
        },
        "integer",
    );

    /** Seconds since midnight, as GW-BASIC reckoned it. */
    define("TIMER", 0, 1, () => {
        const now = deps.now();
        return (
            now.getHours() * 3600 +
            now.getMinutes() * 60 +
            now.getSeconds() +
            now.getMilliseconds() / 1000
        );
    });

    define("TIME$", 0, 1, () => {
        const now = deps.now();
        return [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map((part) => String(part).padStart(2, "0"))
            .join(":");
    });

    /** MM-DD-YYYY, which is how the machines of the period wrote it. */
    define("DATE$", 0, 1, () => {
        const now = deps.now();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${month}-${day}-${now.getFullYear()}`;
    });

    /* ---------------- strings ---------------- */

    define("LEN", 1, 1, (a) => str(a[0]).length, "integer");

    define("LEFT$", 2, 2, (a) => str(a[0]).slice(0, countArgument(a[1].value)));

    define("RIGHT$", 2, 2, (a) => {
        const text = str(a[0]);
        const count = countArgument(a[1].value);
        return count === 0 ? "" : text.slice(Math.max(0, text.length - count));
    });

    /**
     * MID$(a$, start[, length]). Positions count from 1, so a start of
     * 0 is an error rather than a synonym for the beginning.
     */
    define("MID$", 2, 3, (a) => {
        const text = str(a[0]);
        const start = positionArgument(a[1].value);
        if (a.length < 3) return text.slice(start - 1);
        return text.slice(start - 1, start - 1 + countArgument(a[2].value));
    });

    /* Through the machine's character ROM, not Latin-1: see cp437.ts. */
    define("CHR$", 1, 1, (a) => {
        const code = Math.trunc(num(a[0]));
        if (code < 0 || code > 255) throw new BasicError("ILLEGAL QUANTITY");
        return characterForCode(code);
    });

    define(
        "ASC",
        1,
        1,
        (a) => {
            const text = str(a[0]);
            if (text.length === 0) throw new BasicError("ILLEGAL QUANTITY");
            return codeForCharacter(splitStringIntoCharacters(text)[0]);
        },
        "integer",
    );

    /**
     * The number exactly as PRINT would show it, minus the trailing
     * space -- so STR$(1) is " 1", keeping the sign position. Programs
     * that want the digits alone reach for RIGHT$ afterwards.
     */
    /* STR$ shows the argument at its own width, so STR$(A#) keeps
     * sixteen digits where STR$(A) would round to six. This is the one
     * place in the table that reads an argument's type. */
    define("STR$", 1, 1, (a) => formatNumberForStr(num(a[0]), a[0].type));

    /** The leading number in the text, or 0 if it does not start with one. */
    define("VAL", 1, 1, (a) => {
        const match = str(a[0])
            .trimStart()
            .match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
        return match === null ? 0 : Number(match[0]);
    });

    /** INSTR([start,] haystack$, needle$), counting from 1; 0 if absent. */
    define(
        "INSTR",
        2,
        3,
        (a) => {
            const hasStart = a.length === 3;
            const start = hasStart ? positionArgument(a[0].value) : 1;
            const haystack = str(a[hasStart ? 1 : 0]);
            const needle = str(a[hasStart ? 2 : 1]);
            return haystack.indexOf(needle, start - 1) + 1;
        },
        "integer",
    );

    /** STRING$(n, c) -- c as a character code, or the first of a string. */
    define("STRING$", 2, 2, (a) => {
        const count = countArgument(a[0].value);
        const source = a[1].value;
        const char =
            typeof source === "string"
                ? (splitStringIntoCharacters(source)[0] ?? "")
                : characterForCode(Math.trunc(source));
        if (char.length === 0) throw new BasicError("ILLEGAL QUANTITY");
        return checkStringLength(char.repeat(count));
    });

    define("SPACE$", 1, 1, (a) =>
        checkStringLength(" ".repeat(countArgument(a[0].value))),
    );

    /**
     * HEX$ and OCT$ show a number in base 16 or base 8.
     *
     * Both round to a whole number first and both work on sixteen bits,
     * so a negative comes out as its two's complement -- HEX$(-1) is
     * "FFFF", not "-1". That is not a quirk of ours: the original was
     * showing you the bit pattern, which is the only reason you would
     * ask for hex in the first place.
     */
    define("HEX$", 1, 1, (a) => baseString(a[0].value, 16));
    define("OCT$", 1, 1, (a) => baseString(a[0].value, 8));

    return table;
}

/*
 * Arguments arrive as values with their widths attached. Almost nothing
 * in the table cares about the width, so these two unwrap; the handful
 * that do -- STR$ so far -- read `.type' off the argument directly.
 */

function num(arg: Typed): number {
    return asNumber(arg.value);
}

function str(arg: Typed): string {
    return asString(arg.value);
}

/** A sixteen-bit value in the given base, upper case and unsigned. */
function baseString(value: Value, base: number): string {
    const n = toInt16(value);
    const unsigned = n < 0 ? n + 0x10000 : n;
    return unsigned.toString(base).toUpperCase();
}

/** A length or count: whole, and not negative. */
function countArgument(value: Value): number {
    const count = Math.trunc(asNumber(value));
    if (count < 0 || count > 255) throw new BasicError("ILLEGAL QUANTITY");
    return count;
}

/** A position within a string: whole, and at least 1. */
function positionArgument(value: Value): number {
    const position = Math.trunc(asNumber(value));
    if (position < 1 || position > 255)
        throw new BasicError("ILLEGAL QUANTITY");
    return position;
}
