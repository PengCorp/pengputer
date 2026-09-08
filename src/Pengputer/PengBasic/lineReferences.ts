/**
 * Which numbers in a line are references to *other lines*.
 *
 * `GOTO 100' and `PRINT 100' both contain the token 100, and only the
 * first is a line number. Telling them apart is a lexical rule, not a
 * semantic one: a number is a line reference when it follows one of a
 * small set of keywords, plus any further comma-separated numbers after
 * GOTO or GOSUB, which is what `ON X GOTO 10,20,30' needs.
 *
 * This exists as one shared rule rather than being scattered through
 * the parser because RENUM (stage 10) has to apply exactly the same
 * rule to *rewrite* those numbers -- and it works on tokens, splicing
 * new numbers into the stored source text at each token's recorded
 * position so the typist's spacing survives. Two copies of this rule
 * would drift, and the failure would be a silently corrupted program.
 */
import { tokenize } from "./Tokenizer";
import { isBasicError } from "./errors";
import type { Keyword, Token } from "./tokens";

/** After one of these, a number is a line number. */
export const LINE_NUMBER_KEYWORDS: ReadonlySet<Keyword> = new Set<Keyword>([
    "GOTO",
    "GOSUB",
    "THEN",
    "ELSE",
    "RESTORE",
]);

/** Keywords whose line numbers may be a comma-separated list. */
const LIST_KEYWORDS: ReadonlySet<Keyword> = new Set<Keyword>(["GOTO", "GOSUB"]);

/**
 * Indices into `tokens' of every number that names a line.
 *
 * `THEN 100' counts; `THEN PRINT 100' does not, because only a number
 * *immediately* after the keyword is a target.
 */
export function findLineReferences(tokens: Token[]): number[] {
    const found: number[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token.kind !== "keyword") continue;
        if (!LINE_NUMBER_KEYWORDS.has(token.keyword)) continue;

        let at = i + 1;
        if (tokens[at]?.kind !== "number") continue;
        found.push(at);

        if (!LIST_KEYWORDS.has(token.keyword)) continue;

        /* ON X GOTO 10,20,30 */
        for (;;) {
            const comma = tokens[at + 1];
            if (!comma || comma.kind !== "punct" || comma.punct !== ",") break;
            if (tokens[at + 2]?.kind !== "number") break;
            at += 2;
            found.push(at);
        }
    }

    return found;
}

export interface RewriteResult {
    source: string;
    /** Targets that no longer exist; left alone, and worth reporting. */
    missing: number[];
}

/**
 * Rewrites a line's references to other lines, in place in its text.
 *
 * This is why the tokens have carried a `pos' since §11.1. Nothing else
 * about the line is touched -- the new numbers are spliced into the
 * stored source at exactly the characters the old ones occupied, so a
 * renumbered program still LISTs with the typist's spacing intact.
 *
 * The splices go right to left, so each one cannot disturb the
 * positions of the ones still to come.
 */
export function rewriteLineReferences(
    source: string,
    map: ReadonlyMap<number, number>,
): RewriteResult {
    let tokens: Token[];
    try {
        tokens = tokenize(source);
    } catch (e) {
        /* A line that will not even tokenize has no references we can
         * trust. Leave it exactly as it is. */
        if (!isBasicError(e)) throw e;
        return { source, missing: [] };
    }

    const references = findLineReferences(tokens);
    const missing: number[] = [];
    let out = source;

    for (let i = references.length - 1; i >= 0; i -= 1) {
        const token = tokens[references[i]];
        if (token.kind !== "number") continue;

        const target = map.get(token.value);
        if (target === undefined) {
            missing.unshift(token.value);
            continue;
        }

        let end = token.pos;
        while (end < out.length && out[end] >= "0" && out[end] <= "9") end += 1;
        out = out.slice(0, token.pos) + String(target) + out.slice(end);
    }

    return { source: out, missing };
}
