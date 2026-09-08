/**
 * Code page 437 -- the character set the machine's ROM actually has.
 *
 * `CHR$(176)` on a PC of this era gave the light shade block, not the
 * degree sign: the byte 176 indexes the character ROM, and that ROM is
 * CP437. JavaScript's `String.fromCharCode` would give Latin-1 instead,
 * so every listing that draws with blocks would come out as punctuation.
 *
 * The rows below are copied from the VGA font's own value map, so the
 * two cannot drift: anything CHR$ can produce is something the font can
 * draw.
 */
import { splitStringIntoCharacters } from "@Toolbox/String";

/* 32 characters per row, 8 rows, in code order. */
const CP437_ROWS = [
    " ☺︎☻♥︎♦︎♣︎♠︎•◘○◙♂︎♀︎♪♫☼►◄↕︎‼︎¶§▬↨↑↓→←∟↔︎▲▼",
    " !\"#$%&'()*+,-./0123456789:;<=>?",
    "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_",
    "`abcdefghijklmnopqrstuvwxyz{|}~⌂",
    "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ",
    "áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐",
    "└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀",
    "αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ",
];

const CHARACTER_BY_CODE: string[] = CP437_ROWS.flatMap((row) =>
    splitStringIntoCharacters(row),
);

/**
 * The reverse, for ASC.
 *
 * Several codes draw the same glyph -- a blank sits at 0, 32 and 255 --
 * so the printable range is filled in first and the low codes only
 * claim what is still unspoken for. Otherwise `ASC(" ")` would answer
 * 0 rather than 32.
 */
const CODE_BY_CHARACTER = new Map<string, number>();
for (let code = 32; code < CHARACTER_BY_CODE.length; code += 1) {
    const character = CHARACTER_BY_CODE[code];
    if (!CODE_BY_CHARACTER.has(character))
        CODE_BY_CHARACTER.set(character, code);
}
for (let code = 0; code < 32; code += 1) {
    const character = CHARACTER_BY_CODE[code];
    if (!CODE_BY_CHARACTER.has(character))
        CODE_BY_CHARACTER.set(character, code);
}

/**
 * Codes that *do* something rather than showing a glyph.
 *
 * CP437 has pictures at these positions -- 13 is a musical note -- but
 * a program writing CHR$(13) means a carriage return, and always did.
 * Everything else, including the smileys and card suits at 1-6, is a
 * character to draw.
 */
const CONTROL_CODES = new Set([7, 8, 9, 10, 11, 12, 13]);

export function characterForCode(code: number): string {
    if (CONTROL_CODES.has(code)) return String.fromCharCode(code);
    return CHARACTER_BY_CODE[code] ?? " ";
}

export function codeForCharacter(character: string): number {
    if (character.length === 1) {
        const code = character.charCodeAt(0);
        if (CONTROL_CODES.has(code)) return code;
    }
    return CODE_BY_CHARACTER.get(character) ?? character.charCodeAt(0);
}
