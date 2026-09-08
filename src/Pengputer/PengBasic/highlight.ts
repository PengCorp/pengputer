/**
 * Splitting a line of BASIC into coloured pieces.
 *
 * The tokenizer already knows what everything is, so this is mostly a
 * table from token kind to role (§palette). Two things make it more than
 * that.
 *
 * SPACING IS PRESERVED EXACTLY
 *
 * `LIST` promises to show a program back the way it was typed, so the
 * highlighter may not reformat anything. Tokens carry a `pos' but not a
 * length, so a token's text is taken as the source between it and the
 * next token, minus any trailing space -- and that space is emitted
 * separately as plain text. The `pos' field exists for RENUM (§22.1);
 * this is the second thing to want it, for the same reason.
 *
 * A LINE THAT WILL NOT TOKENIZE STILL LISTS
 *
 * Lines are stored as text and parsed only when run, so a program may
 * well contain a line that does not tokenize -- an unterminated string,
 * say. `LIST` has to show it anyway, and arguably that is when you most
 * want to see it. Anything that throws here comes back as one plain
 * span.
 */
import { tokenize } from "./Tokenizer";
import { keywordKind, nameWithSigil } from "./tokens";
import type { SyntaxRole } from "./palette";

export interface HighlightSpan {
    text: string;
    role: SyntaxRole;
}

/**
 * Whether a name is a supplied function.
 *
 * Passed in rather than imported because the table belongs to the
 * running interpreter -- and because it is the one distinction a listing
 * gives no other clue about: `LEN(A$)` and `FOO(3)` are spelled the same
 * and only the table says which is a call and which a subscript.
 */
export type IsBuiltin = (name: string) => boolean;

export function highlightLine(
    source: string,
    isBuiltin: IsBuiltin = () => false,
): HighlightSpan[] {
    try {
        return spansOf(source, isBuiltin);
    } catch {
        return [{ text: source, role: "text" }];
    }
}

function spansOf(source: string, isBuiltin: IsBuiltin): HighlightSpan[] {
    const tokens = tokenize(source);
    const spans: HighlightSpan[] = [];
    let at = 0;

    const push = (text: string, role: SyntaxRole) => {
        if (text.length === 0) return;
        const last = spans[spans.length - 1];
        /* Runs of the same role join up, which keeps the span list short
         * and the colour changes down to the ones that matter. */
        if (last && last.role === role) last.text += text;
        else spans.push({ text, role });
    };

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token.kind === "end") break;

        /* Whatever sits between the last token and this one is spacing. */
        if (token.pos > at) push(source.slice(at, token.pos), "text");

        const bound = tokens[i + 1]?.pos ?? source.length;
        let text = source.slice(token.pos, bound).replace(/\s+$/, "");
        if (text.length === 0) continue;

        /*
         * A DATA item takes the comma after it with it -- the scanner
         * eats the separator rather than emitting a token for it -- so
         * the comma is handed back to the punctuation here, or a row of
         * numbers comes out with its commas coloured as digits.
         */
        const separator = token.kind === "data" && text.endsWith(",");
        if (separator) text = text.slice(0, -1);

        /* Whatever space sat between the value and its comma is spacing
         * like any other, and has to survive. */
        const value = text.replace(/\s+$/, "");
        push(value, roleOf(token, isBuiltin));
        push(text.slice(value.length), "text");
        at = token.pos + text.length;

        if (separator) {
            push(",", "operator");
            at += 1;
        }
    }

    if (at < source.length) push(source.slice(at), "text");
    return spans;
}

function roleOf(
    token: ReturnType<typeof tokenize>[number],
    isBuiltin: IsBuiltin,
): SyntaxRole {
    switch (token.kind) {
        /*
         * Which sort of keyword it is comes from the keyword table
         * itself (`KeywordKind'), not from a list kept here -- the
         * colouring has no business holding its own opinion about what
         * IF is.
         */
        case "keyword":
            switch (keywordKind(token.keyword)) {
                case "control":
                    return "controlFlow";
                case "declaration":
                    return "keyword";
                case "command":
                    return "builtin";
            }

        case "operator":
        case "punct":
            return "operator";

        case "number":
            return "number";

        case "string":
            return "string";

        case "remark":
            return "comment";

        /* A DATA item is a value written where a value goes, so it is
         * coloured as the value it is rather than as program text. */
        case "data":
            if (token.quoted) return "string";
            return Number.isNaN(Number(token.value)) ? "text" : "number";

        case "name": {
            const name = nameWithSigil(token);
            /* FN marks a function of the program's own, and is the only
             * name in BASIC that says what it is. */
            if (name.startsWith("FN") && name.length > 2) return "function";
            return isBuiltin(name) ? "builtin" : "text";
        }

        default:
            return "text";
    }
}
