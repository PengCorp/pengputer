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
import type { Builtin, Builtins } from "./Evaluator";
import type { Console } from "./console";
import type { Random } from "./random";
import {
    asNumber,
    asString,
    checkOverflow,
    checkStringLength,
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

    const define = (
        name: string,
        minArgs: number,
        maxArgs: number,
        call: (args: Value[]) => Value,
    ) => {
        table.set(name, { minArgs, maxArgs, call });
    };

    /* ---------------- numeric ---------------- */

    define("ABS", 1, 1, (a) => Math.abs(asNumber(a[0])));
    define("SGN", 1, 1, (a) => Math.sign(asNumber(a[0])));

    /**
     * INT rounds *down*, always -- INT(-2.5) is -3, not -2. It is not
     * the same operation as storing into an integer variable, which
     * rounds to nearest (§13.2).
     */
    define("INT", 1, 1, (a) => Math.floor(asNumber(a[0])));

    define("SQR", 1, 1, (a) => {
        const x = asNumber(a[0]);
        if (x < 0) throw new BasicError("ILLEGAL QUANTITY");
        return Math.sqrt(x);
    });

    define("SIN", 1, 1, (a) => Math.sin(asNumber(a[0])));
    define("COS", 1, 1, (a) => Math.cos(asNumber(a[0])));
    define("TAN", 1, 1, (a) => Math.tan(asNumber(a[0])));
    define("ATN", 1, 1, (a) => Math.atan(asNumber(a[0])));

    define("EXP", 1, 1, (a) => checkOverflow(Math.exp(asNumber(a[0]))));

    define("LOG", 1, 1, (a) => {
        const x = asNumber(a[0]);
        if (x <= 0) throw new BasicError("ILLEGAL QUANTITY");
        return Math.log(x);
    });

    /* See random.ts for why the sign of the argument matters. */
    define("RND", 0, 1, (a) => {
        const x = a.length === 0 ? 1 : asNumber(a[0]);
        if (x < 0) {
            deps.random.seed(x);
            return deps.random.next();
        }
        return x === 0 ? deps.random.repeat() : deps.random.next();
    });

    define("FRE", 0, 1, () => FREE_BYTES);

    /** The column PRINT would write to next, counting from 1. */
    define("POS", 0, 1, () => deps.machine.getColumn() + 1);
    define("CSRLIN", 0, 0, () => deps.machine.getCursorRow() + 1);

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
    define("SCREEN", 2, 2, (a) => {
        const row = positionArgument(a[0]);
        const column = positionArgument(a[1]);
        return codeForCharacter(deps.machine.readCharacter(row - 1, column - 1));
    });

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

    define("LEN", 1, 1, (a) => asString(a[0]).length);

    define("LEFT$", 2, 2, (a) =>
        asString(a[0]).slice(0, countArgument(a[1])),
    );

    define("RIGHT$", 2, 2, (a) => {
        const text = asString(a[0]);
        const count = countArgument(a[1]);
        return count === 0 ? "" : text.slice(Math.max(0, text.length - count));
    });

    /**
     * MID$(a$, start[, length]). Positions count from 1, so a start of
     * 0 is an error rather than a synonym for the beginning.
     */
    define("MID$", 2, 3, (a) => {
        const text = asString(a[0]);
        const start = positionArgument(a[1]);
        if (a.length < 3) return text.slice(start - 1);
        return text.slice(start - 1, start - 1 + countArgument(a[2]));
    });

    /* Through the machine's character ROM, not Latin-1: see cp437.ts. */
    define("CHR$", 1, 1, (a) => {
        const code = Math.trunc(asNumber(a[0]));
        if (code < 0 || code > 255) throw new BasicError("ILLEGAL QUANTITY");
        return characterForCode(code);
    });

    define("ASC", 1, 1, (a) => {
        const text = asString(a[0]);
        if (text.length === 0) throw new BasicError("ILLEGAL QUANTITY");
        return codeForCharacter(splitStringIntoCharacters(text)[0]);
    });

    /**
     * The number exactly as PRINT would show it, minus the trailing
     * space -- so STR$(1) is " 1", keeping the sign position. Programs
     * that want the digits alone reach for RIGHT$ afterwards.
     */
    define("STR$", 1, 1, (a) => formatNumberForStr(asNumber(a[0])));

    /** The leading number in the text, or 0 if it does not start with one. */
    define("VAL", 1, 1, (a) => {
        const match = asString(a[0])
            .trimStart()
            .match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
        return match === null ? 0 : Number(match[0]);
    });

    /** INSTR([start,] haystack$, needle$), counting from 1; 0 if absent. */
    define("INSTR", 2, 3, (a) => {
        const hasStart = a.length === 3;
        const start = hasStart ? positionArgument(a[0]) : 1;
        const haystack = asString(a[hasStart ? 1 : 0]);
        const needle = asString(a[hasStart ? 2 : 1]);
        return haystack.indexOf(needle, start - 1) + 1;
    });

    /** STRING$(n, c) -- c as a character code, or the first of a string. */
    define("STRING$", 2, 2, (a) => {
        const count = countArgument(a[0]);
        const source = a[1];
        const char =
            typeof source === "string"
                ? (splitStringIntoCharacters(source)[0] ?? "")
                : characterForCode(Math.trunc(source));
        if (char.length === 0) throw new BasicError("ILLEGAL QUANTITY");
        return checkStringLength(char.repeat(count));
    });

    define("SPACE$", 1, 1, (a) =>
        checkStringLength(" ".repeat(countArgument(a[0]))),
    );

    return table;
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
    if (position < 1 || position > 255) throw new BasicError("ILLEGAL QUANTITY");
    return position;
}
