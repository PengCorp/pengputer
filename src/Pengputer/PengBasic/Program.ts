/**
 * The stored program.
 *
 * Lines are kept as the **source text you typed**, not as parsed trees.
 * Parsing happens on first execution and the result is cached beside
 * the text. That was the decision in the architecture notes, and it
 * buys two things:
 *
 *   - `LIST` reproduces your spacing exactly, because it is replaying
 *     what you typed rather than regenerating it.
 *   - A syntax error surfaces when the line **runs**, as it did on the
 *     original. Parsing eagerly at entry would mean pasting a listing
 *     with one bad line spits an error into the middle of the incoming
 *     text, which is both wrong and unreadable.
 *
 * Alongside the map is a sorted array of line numbers, because a `GOTO`
 * is a *search*: the line number is a key, not an address. That is
 * also why every listing ever printed numbers its lines 10, 20, 30 --
 * the gaps are so you can insert 15 later without renumbering.
 */
import type { Statement } from "./ast";
import { StatementParser } from "./StatementParser";
import { tokenize } from "./Tokenizer";

export const MAX_LINE_NUMBER = 65529;

export interface ProgramLine {
    number: number;
    source: string;
    /** Filled in on first execution. Thrown away when the line changes. */
    statements: Statement[] | null;
}

export class Program {
    private lines: Map<number, ProgramLine> = new Map();
    private numbers: number[] = [];

    clear() {
        this.lines.clear();
        this.numbers = [];
    }

    isEmpty(): boolean {
        return this.numbers.length === 0;
    }

    /** Storing an empty line deletes it, which is how you erase a line. */
    setLine(number: number, source: string) {
        if (source.trim().length === 0) {
            this.deleteLine(number);
            return;
        }

        if (!this.lines.has(number)) {
            this.numbers.splice(this.indexFor(number), 0, number);
        }
        this.lines.set(number, { number, source, statements: null });
    }

    deleteLine(number: number) {
        if (!this.lines.delete(number)) return;
        const index = this.numbers.indexOf(number);
        if (index >= 0) this.numbers.splice(index, 1);
    }

    /** The nth line in line-number order, or null past the end. */
    at(index: number): ProgramLine | null {
        const number = this.numbers[index];
        if (number === undefined) return null;
        return this.lines.get(number) ?? null;
    }

    getCount(): number {
        return this.numbers.length;
    }

    /**
     * Where a line number sits, or would sit. Binary search, because
     * this is what every GOTO in a running program has to do.
     */
    indexFor(number: number): number {
        let low = 0;
        let high = this.numbers.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (this.numbers[mid] < number) low = mid + 1;
            else high = mid;
        }
        return low;
    }

    /** The index of an existing line, or null. Used by GOTO in stage 5. */
    findIndex(number: number): number | null {
        const index = this.indexFor(number);
        return this.numbers[index] === number ? index : null;
    }

    /** Parses on demand and caches. */
    statementsOf(line: ProgramLine): Statement[] {
        if (line.statements === null) {
            line.statements = new StatementParser(tokenize(line.source)).parseLine();
        }
        return line.statements;
    }

    list(from: number | null, to: number | null): ProgramLine[] {
        const result: ProgramLine[] = [];
        for (const number of this.numbers) {
            if (from !== null && number < from) continue;
            if (to !== null && number > to) continue;
            const line = this.lines.get(number);
            if (line) result.push(line);
        }
        return result;
    }
}
