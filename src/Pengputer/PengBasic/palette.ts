/**
 * What the colors *mean*, for anything that shows BASIC source.
 *
 * The machine's classic palette is the usual 16 plus a tertiary set --
 * orange, chartreuse, spring green, azure, violet, rose -- in a dark and
 * a light variant each (`@Color/ansi`). The sixteen come from int10h's
 * measurements of what a real CGA monitor actually put on the glass, and
 * the tertiaries were interpolated in OKLCH rather than by averaging RGB.
 *
 * That last detail is why this file could be built by measurement. OKLCH
 * holds perceptual lightness steady around the hue circle, so the
 * tertiaries sit at the same apparent brightness as the primaries they
 * came from -- which means matching a target color to the nearest
 * palette entry gives one clear winner rather than a tie between
 * something too dark and something too bright. Seven of the eight roles
 * below were settled that way with no argument.
 *
 * Roles are named for what they *are*, not for how they look, so that
 * changing a color is a change in one line here rather than a hunt
 * through whatever draws things.
 *
 * More roles are defined than PengBASIC currently uses. That is on
 * purpose: the set is meant to be a scheme for the machine rather than a
 * list of what one program happens to need today, and a role with no
 * user costs nothing but a line.
 *
 * WHY INDICES AND NOT `Color` OBJECTS
 *
 * These are indices into the classic palette, read out of the palette's
 * own name table rather than written as numbers, so the two cannot drift
 * apart -- the same reason `cp437.ts` is built from the font's value map.
 * Indices are also what a port can carry: `Console.setColor` speaks CGA
 * numbers, which only reach the first 16, so anything wanting the
 * tertiary colors needs a route that takes a palette index directly.
 */
import { classicColors } from "@Color/ansi";
import { ColorType, type Color } from "@Color/Color";
import type { ColorName } from "@Color/types";

/**
 * The classic-palette index a color name stands for.
 *
 * `classicColors` is typed as the general `Color` union, so this
 * narrows -- and throws rather than guessing if the table ever stops
 * holding classic colors, which is the failure worth being loud about.
 */
function index(name: ColorName): number {
    const color = classicColors[name];
    if (color.type !== ColorType.Classic) {
        throw new Error(`${name} is not a classic palette color`);
    }
    return color.index;
}

/**
 * A part of a program, as far as coloring is concerned.
 *
 * The distinctions are the ones a *reader* cares about, which are not
 * quite the ones a tokenizer makes. `LEN` and `SQR` are names to the
 * tokenizer and built-ins to a reader; `PRINT` and `THEN` are both
 * keywords to the tokenizer and both keywords to a reader.
 */
export type SyntaxRole =
    /** Ordinary program text: variable names, spacing, anything unclaimed. */
    | "text"
    /** Text that should stand out without meaning anything in particular. */
    | "strong"
    /** Words that move the program counter or bound a block: IF, FOR, GOTO. */
    | "controlFlow"
    /** Words that declare rather than do: DIM, DEF, CONST, DEFINT. */
    | "keyword"
    /** Arithmetic, comparison and logical operators, and punctuation. */
    | "operator"
    /** Quoted text, quotes included. */
    | "string"
    /** Numeric literals, and named constants once CONST has made any. */
    | "number"
    /** A function of the program's own -- DEF FN, and calls to one. */
    | "function"
    /** A type marker. Defined; nothing produces it -- see the note below. */
    | "type"
    /** Anything the machine supplies: PRINT and CLS as much as LEN and SQR. */
    | "builtin"
    /** Something passed or bound. Defined; nothing produces it yet. */
    | "parameter"
    /** REM and the apostrophe form, and whatever they swallow. */
    | "comment"
    /** A comment carrying structure rather than an aside. Not produced yet. */
    | "docComment";

/**
 * The scheme.
 *
 * Matched to a set of target colors by perceptual distance, which
 * picked seven of the eight on its own. Numbers were the exception: the
 * metric preferred light magenta by a hair, but the target reads as
 * purple and magenta reads as pink, so violet won on character.
 *
 * The distinctions worth understanding:
 *
 *   - **Control flow against structural keywords.** Red for the words
 *     that move you somewhere -- IF, FOR, GOTO, RETURN; orange for the
 *     ones that declare something -- DIM, DEF, CONST. Reading a listing
 *     is mostly following the first kind, so they get the loudest
 *     color on the screen.
 *   - **Built-ins against a program's own functions.** Cyan for
 *     everything the machine supplies, whether statement or function --
 *     PRINT and CLS sit with LEN and SQR, because to a reader they are
 *     the same thing: something that was already here. Chartreuse for
 *     what the program added.
 *   - **Variables are the quiet ones.** Plain gray, the same as
 *     spacing, because a listing is mostly variables and coloring them
 *     would leave nothing for the color to mean.
 */
export const SYNTAX_COLORS: Readonly<Record<SyntaxRole, number>> = {
    text: index("lightGray"),
    strong: index("white"),

    controlFlow: index("lightRed"),
    keyword: index("lightOrange"),

    /*
     * The one role the scheme did not name. Rose, which the control-flow
     * red freed up: an operator is grammar rather than content, so it
     * earns a color of its own, and pink against red reads as a
     * relation between them rather than as a clash.
     */
    operator: index("lightRose"),

    string: index("lightYellow"),
    number: index("lightViolet"),

    function: index("lightChartreuse"),
    builtin: index("lightCyan"),

    comment: index("darkGray"),

    /*
     * The three below have no producer. `DEFINT' and friends declare,
     * so they are colored as structural keywords rather than as their
     * own thing, which leaves `type' spare. Kept because the set is
     * meant to be a scheme rather than an inventory of today's needs --
     * and because a role with no user costs a line.
     */
    type: index("lightSpringGreen"),
    parameter: index("lightAzure"),
    docComment: index("springGreen"),
};

/**
 * The color a listing sits on.
 *
 * This comes out as index 31 rather than 0: the tertiary rows do not
 * fill their 32 slots, and the spare ones are deliberately set to black,
 * so the *name* resolves to the last of them. Every one of them renders
 * black, so it makes no difference -- worth saying only because the
 * number looks wrong at a glance and is not.
 */
export const SYNTAX_BACKGROUND = index("black");

/** A palette index as the machine's own color type. */
export function paletteColor(index: number): Color {
    return classicColors[index];
}
