/**
 * Running statements.
 *
 * Two modes, and the difference is only where the statements came from:
 *
 *   - **Immediate.** A line typed without a number executes now.
 *   - **Stored.** A line typed with a number goes into the program and
 *     waits for RUN.
 *
 * The run loop already keeps a *position* -- which line, which
 * statement within it -- even though nothing can jump yet. That is the
 * hook stage 5 needs: GOTO sets the position and lets the loop carry
 * on, rather than the loop being rewritten around it.
 */
import { BasicError } from "./errors";
import { Evaluator, type Builtins } from "./Evaluator";
import { createBuiltins } from "./builtins";
import { printUsing } from "./printUsing";
import { Random } from "./random";
import { Program, MAX_LINE_NUMBER } from "./Program";
import { rewriteLineReferences } from "./lineReferences";
import { StatementParser } from "./StatementParser";
import { Variables } from "./Variables";
import { formatValue, PRINT_ZONE_WIDTH } from "./format";
import { tokenize } from "./Tokenizer";
import type {
    DataItem,
    Expr,
    FnDefinition,
    LoopVariable,
    LValue,
    Statement,
} from "./ast";
import type { Console } from "./console";
import { asNumber, asString, typeOfSigil, type Value } from "./values";

/**
 * `INPUT A,B' reads one line and splits it on commas, with surrounding
 * spaces trimmed. Quoted fields keep theirs, which is how a value with
 * a comma in it gets in at all.
 */
function splitInputFields(line: string): string[] {
    const fields: string[] = [];
    let field = "";
    let quoted = false;

    for (const char of line) {
        if (char === '"') {
            quoted = !quoted;
            continue;
        }
        if (char === "," && !quoted) {
            fields.push(field.trim());
            field = "";
            continue;
        }
        field += char;
    }
    fields.push(field.trim());

    return fields;
}

/** A typed-in number, or null if it is not one. Empty means zero. */
function parseInputNumber(field: string): number | null {
    const text = field.trim();
    if (text.length === 0) return 0;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return null;
    return Number(text);
}

/**
 * What a typed line turned out to be. The prompt needs to know: "Ok"
 * follows something the machine *did*, not a line filed away for later.
 */
export type LineOutcome = "stored" | "executed";

/** Statements between turns given back to the host. */
const STEPS_PER_YIELD = 2000;

/** How long DELAY sleeps before looking for a Ctrl+C. */
const BREAK_CHECK_SLICE_MS = 50;

function yieldToHost(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Where execution is: which line, and which statement within it. */
interface Position {
    lineIndex: number;
    statementIndex: number;
}

/**
 * One active FOR.
 *
 * `resume' is the statement straight after the FOR, which is where NEXT
 * jumps back to -- so the loop body is found by position, not by
 * rescanning for the matching NEXT.
 */
interface ForFrame {
    variable: LoopVariable;
    limit: number;
    step: number;
    resume: Position;
}

/** One active WHILE. WEND re-tests the condition it captured. */
interface WhileFrame {
    condition: Expr;
    resume: Position;
}

/**
 * How far READ has got. A third index, because one DATA statement holds
 * several items and the pointer has to stop part-way through one.
 */
interface DataPointer {
    lineIndex: number;
    statementIndex: number;
    itemIndex: number;
}

export class Interpreter {
    private console: Console;
    private program: Program = new Program();
    private variables: Variables = new Variables();
    private evaluator: Evaluator;

    /** DEF FN definitions, by name plus sigil. Cleared with variables. */
    private functions: Map<string, FnDefinition> = new Map();

    private random: Random = new Random();

    /**
     * What the next prompt should start out containing.
     *
     * EDIT sets it once; AUTO keeps setting it. Both are really about
     * the *prompt* rather than about running anything, so the
     * interpreter only holds the state and the shell asks for it.
     */
    private pendingPrefill: string | null = null;
    private auto: { next: number; increment: number } | null = null;

    /** The line being executed, for `?SYNTAX ERROR IN 100'. */
    private runningLine: number | null = null;

    private stopped: boolean = false;

    private position: Position = { lineIndex: 0, statementIndex: 0 };

    /**
     * The three stacks. GOSUB and FOR are independent in BASIC -- you
     * can GOSUB out of a loop and back into it -- so they cannot share
     * one stack the way a language with proper frames would.
     */
    private returnStack: Position[] = [];
    private forStack: ForFrame[] = [];
    private whileStack: WhileFrame[] = [];

    /** Set by STOP, consumed by CONT. */
    private continuePosition: Position | null = null;

    private tracing: boolean = false;

    /** Walks the program's DATA statements in line order. */
    private dataPointer: DataPointer = {
        lineIndex: 0,
        statementIndex: 0,
        itemIndex: 0,
    };

    constructor(machine: Console, builtins?: Builtins, now: () => Date = () => new Date()) {
        this.console = machine;
        this.evaluator = new Evaluator(
            this.variables,
            builtins ?? createBuiltins({ machine, random: this.random, now }),
            this.functions,
        );
    }

    /** Null unless a stored line is running. */
    getRunningLine(): number | null {
        return this.runningLine;
    }

    /**
     * Text the next prompt should be pre-filled with, and consumed by
     * asking. Null when the user is simply typing.
     */
    takePendingPrefill(): string | null {
        if (this.pendingPrefill !== null) {
            const prefill = this.pendingPrefill;
            this.pendingPrefill = null;
            return prefill;
        }
        return this.auto === null ? null : `${this.auto.next} `;
    }

    /** Leaves AUTO mode. The shell calls this on Ctrl+C. */
    cancelAuto() {
        this.auto = null;
    }

    getIsAuto(): boolean {
        return this.auto !== null;
    }

    /**
     * One line from the prompt.
     *
     * A leading number stores it; anything else runs now. This single
     * rule is the whole of BASIC's editor, and the reason pasting a
     * listing works without a LOAD command.
     */
    async executeLine(source: string): Promise<LineOutcome> {
        this.runningLine = null;

        const tokens = tokenize(source);
        const first = tokens[0];

        if (first.kind === "number") {
            if (!Number.isInteger(first.value) || first.value < 0 || first.value > MAX_LINE_NUMBER) {
                throw new BasicError("SYNTAX", first.pos);
            }
            this.program.setLine(first.value, source.slice(tokens[1].pos));
            /* Editing the program is what makes CONT impossible. */
            this.continuePosition = null;
            /* Count on from the line actually entered, not from what was
             * suggested -- typing over the offered number should work. */
            if (this.auto !== null) {
                this.auto.next = first.value + this.auto.increment;
            }
            return "stored";
        }

        for (const statement of new StatementParser(tokens).parseLine()) {
            await this.execute(statement);
        }
        return "executed";
    }

    private async runProgram() {
        this.variables.clear();
        this.functions.clear();
        this.returnStack = [];
        this.forStack = [];
        this.whileStack = [];
        this.continuePosition = null;
        this.position = { lineIndex: 0, statementIndex: 0 };
        this.dataPointer = { lineIndex: 0, statementIndex: 0, itemIndex: 0 };
        await this.resume();
    }

    /**
     * The main loop.
     *
     * The position is interpreter state rather than a local, which is
     * the whole trick: GOTO, GOSUB, NEXT and WEND just assign to it and
     * let the loop carry on. Nothing here knows they exist.
     */
    private async resume() {
        this.stopped = false;
        let tracedLine: number | null = null;
        let steps = 0;

        while (!this.stopped) {
            const line = this.program.at(this.position.lineIndex);
            if (line === null) break;

            this.runningLine = line.number;
            const statements = this.program.statementsOf(line);

            if (this.position.statementIndex >= statements.length) {
                this.position.lineIndex += 1;
                this.position.statementIndex = 0;
                continue;
            }

            if (this.tracing && line.number !== tracedLine) {
                tracedLine = line.number;
                this.console.write(`[${line.number}]`);
            }

            const statement = statements[this.position.statementIndex];
            this.position.statementIndex += 1;
            await this.execute(statement);

            /* Hand the browser a turn now and then, or a tight BASIC
             * loop would wedge the page -- and while we are stopped,
             * notice if the user asked to break out. */
            steps += 1;
            if (steps % STEPS_PER_YIELD === 0) {
                await yieldToHost();
                if (this.console.checkBreak()) this.breakOut();
            }
        }

        this.runningLine = null;
    }

    /** Moves execution to a line number, or `?UNDEF'D STATEMENT'. */
    private jumpTo(lineNumber: number) {
        const index = this.program.findIndex(lineNumber);
        if (index === null) throw new BasicError("UNDEF'D STATEMENT");
        this.position = { lineIndex: index, statementIndex: 0 };
    }

    private async execute(statement: Statement) {
        switch (statement.kind) {
            case "remark":
                return;

            case "let":
                this.assign(statement.target, this.evaluator.evaluate(statement.value));
                return;

            case "print":
                this.print(statement);
                return;

            case "dim":
                for (const entry of statement.entries) {
                    this.variables.dimension(
                        entry.name,
                        entry.sigil,
                        entry.bounds.map((bound) => this.number(bound)),
                    );
                }
                return;

            case "end":
                this.stopped = true;
                return;

            case "goto":
                this.jumpTo(statement.line);
                return;

            case "gosub":
                /* The position has already stepped past the GOSUB, so
                 * this is where RETURN comes back to. */
                this.returnStack.push({ ...this.position });
                this.jumpTo(statement.line);
                return;

            case "return": {
                const back = this.returnStack.pop();
                if (!back) throw new BasicError("RETURN WITHOUT GOSUB");
                this.position = back;
                return;
            }

            case "if":
                await this.executeIf(statement);
                return;

            case "for":
                this.executeFor(statement);
                return;

            case "next":
                this.executeNext(statement);
                return;

            case "on":
                this.executeOn(statement);
                return;

            case "stop":
                this.breakOut();
                return;

            case "cont": {
                const from = this.continuePosition;
                if (from === null) throw new BasicError("CAN'T CONTINUE");
                this.continuePosition = null;
                this.position = from;
                await this.resume();
                return;
            }

            case "while":
                this.executeWhile(statement);
                return;

            case "wend":
                this.executeWend();
                return;

            case "swap":
                this.executeSwap(statement);
                return;

            case "trace":
                this.tracing = statement.on;
                return;

            case "data":
                /* Inert where it stands. READ comes and finds it. */
                return;

            case "input":
                await this.executeInput(statement);
                return;

            case "lineInput":
                await this.executeLineInput(statement);
                return;

            case "read":
                this.executeRead(statement);
                return;

            case "restore":
                this.executeRestore(statement);
                return;

            case "delete":
                for (const line of this.program.list(statement.from, statement.to)) {
                    this.program.deleteLine(line.number);
                }
                this.continuePosition = null;
                return;

            case "renum":
                this.executeRenum(statement);
                return;

            case "auto":
                this.auto = {
                    next: statement.start ?? 10,
                    increment: statement.increment ?? 10,
                };
                return;

            case "edit": {
                const line = this.program.at(
                    this.program.findIndex(statement.line) ?? -1,
                );
                if (line === null) throw new BasicError("UNDEF'D STATEMENT");
                this.pendingPrefill = `${line.number} ${line.source}`;
                return;
            }

            case "cls":
                this.console.clear();
                return;

            case "delay":
                await this.delay(this.number(statement.milliseconds));
                return;

            case "locate": {
                /* BASIC counts from 1; an omitted part stays put. */
                const row =
                    statement.row === null
                        ? this.console.getCursorRow()
                        : Math.trunc(this.number(statement.row)) - 1;
                const column =
                    statement.column === null
                        ? this.console.getColumn()
                        : Math.trunc(this.number(statement.column)) - 1;
                if (row < 0 || column < 0) {
                    throw new BasicError("ILLEGAL QUANTITY");
                }
                this.console.locate(row, column);
                return;
            }

            case "color": {
                const pick = (expr: Expr | null): number | null => {
                    if (expr === null) return null;
                    const index = Math.trunc(this.number(expr));
                    if (index < 0 || index > 15) {
                        throw new BasicError("ILLEGAL QUANTITY");
                    }
                    return index;
                };
                this.console.setColor(
                    pick(statement.foreground),
                    pick(statement.background),
                );
                return;
            }

            case "defType":
                for (const range of statement.ranges) {
                    this.variables.setDefaultType(
                        range.from,
                        range.to,
                        typeOfSigil(statement.suffix),
                    );
                }
                return;

            case "randomize":
                /* A bare RANDOMIZE takes its seed from the clock, so a
                 * program that wants repeatable runs must supply one. */
                this.random.seed(
                    statement.seed === null
                        ? Date.now()
                        : this.number(statement.seed),
                );
                return;

            case "printUsing": {
                const format = asString(this.evaluator.evaluate(statement.format));
                const values = statement.values.map((value) =>
                    this.evaluator.evaluate(value),
                );
                this.console.write(printUsing(format, values));
                if (statement.newline) this.console.write("\n");
                return;
            }

            case "midAssign":
                this.executeMidAssign(statement);
                return;

            case "defFn": {
                const { definition } = statement;
                this.functions.set(definition.name + definition.sigil, definition);
                return;
            }

            case "run":
                await this.runProgram();
                return;

            case "new":
                this.program.clear();
                this.variables.clear();
                this.functions.clear();
                return;

            case "clear":
                this.variables.clear();
                this.functions.clear();
                return;

            case "list":
                for (const line of this.program.list(statement.from, statement.to)) {
                    this.console.write(`${line.number} ${line.source}\n`);
                }
                return;
        }
    }

    private async executeIf(statement: Extract<Statement, { kind: "if" }>) {
        const taken = asNumber(this.evaluator.evaluate(statement.condition)) !== 0;
        const branch = taken ? statement.then : statement.else;
        if (branch === null) return;

        for (const inner of branch) {
            await this.execute(inner);
            /* A jump inside the branch abandons the rest of it. */
            if (this.stopped) return;
        }
    }

    /**
     * FOR sets the counter and remembers where the body starts. It does
     * **not** test the limit -- that happens at NEXT, which is why
     * `FOR I=1 TO 0' still runs its body once.
     */
    private executeFor(statement: Extract<Statement, { kind: "for" }>) {
        const { variable } = statement;

        this.variables.setScalar(
            variable.name,
            variable.sigil,
            this.number(statement.from),
        );

        const step = statement.step === null ? 1 : this.number(statement.step);

        /* Re-entering a loop with the same counter replaces it rather
         * than nesting -- otherwise a GOTO back to a FOR leaks a frame
         * every time round, and book programs do that constantly. */
        const existing = this.forStack.findIndex(
            (frame) => sameVariable(frame.variable, variable),
        );
        if (existing >= 0) this.forStack.length = existing;

        this.forStack.push({
            variable,
            limit: this.number(statement.to),
            step,
            resume: { ...this.position },
        });
    }

    /**
     * `NEXT J,I' is `NEXT J : NEXT I', and the comma changes nothing
     * about that: if J's loop is still running we have just jumped back
     * into its body, so control never reaches the NEXT I. Stopping at
     * the first one that keeps going is what makes the two spellings
     * agree.
     */
    private executeNext(statement: Extract<Statement, { kind: "next" }>) {
        if (statement.variables.length === 0) {
            this.advanceLoop(null);
            return;
        }
        for (const variable of statement.variables) {
            if (this.advanceLoop(variable)) return;
        }
    }

    /**
     * One iteration. `NEXT I' pops any loops nested inside I's, which is
     * how a program legally jumps out of an inner loop.
     *
     * Returns true if the loop is still running, meaning we have jumped
     * back to its body.
     */
    private advanceLoop(variable: LoopVariable | null): boolean {
        let index = this.forStack.length - 1;
        if (variable !== null) {
            while (index >= 0 && !sameVariable(this.forStack[index].variable, variable)) {
                index -= 1;
            }
        }
        if (index < 0) throw new BasicError("NEXT WITHOUT FOR");

        this.forStack.length = index + 1;
        const frame = this.forStack[index];

        const next =
            asNumber(
                this.variables.getScalar(frame.variable.name, frame.variable.sigil),
            ) + frame.step;
        this.variables.setScalar(frame.variable.name, frame.variable.sigil, next);

        const running =
            frame.step >= 0 ? next <= frame.limit : next >= frame.limit;

        if (running) this.position = { ...frame.resume };
        else this.forStack.pop();

        return running;
    }

    /**
     * `ON X GOTO 10,20,30'. Out of range simply falls through, which is
     * the usual way of writing a default case.
     */
    private executeOn(statement: Extract<Statement, { kind: "on" }>) {
        const selector = Math.trunc(this.number(statement.selector));
        if (selector < 0 || selector > 255) {
            throw new BasicError("ILLEGAL QUANTITY");
        }
        const target = statement.lines[selector - 1];
        if (target === undefined) return;

        if (statement.target === "gosub") {
            this.returnStack.push({ ...this.position });
        }
        this.jumpTo(target);
    }

    private executeWhile(statement: Extract<Statement, { kind: "while" }>) {
        if (asNumber(this.evaluator.evaluate(statement.condition)) !== 0) {
            this.whileStack.push({
                condition: statement.condition,
                resume: { ...this.position },
            });
            return;
        }
        this.skipPastWend();
    }

    private executeWend() {
        const frame = this.whileStack[this.whileStack.length - 1];
        if (!frame) throw new BasicError("WEND WITHOUT WHILE");

        if (asNumber(this.evaluator.evaluate(frame.condition)) !== 0) {
            this.position = { ...frame.resume };
            return;
        }
        this.whileStack.pop();
    }

    /**
     * Walks forward to just past the WEND that closes the WHILE we are
     * standing after, counting nesting on the way.
     */
    private skipPastWend() {
        const at: Position = { ...this.position };
        let depth = 1;

        for (;;) {
            const line = this.program.at(at.lineIndex);
            if (line === null) throw new BasicError("WHILE WITHOUT WEND");

            const statements = this.program.statementsOf(line);
            if (at.statementIndex >= statements.length) {
                at.lineIndex += 1;
                at.statementIndex = 0;
                continue;
            }

            const statement = statements[at.statementIndex];
            at.statementIndex += 1;

            if (statement.kind === "while") depth += 1;
            else if (statement.kind === "wend") {
                depth -= 1;
                if (depth === 0) {
                    this.position = { ...at };
                    return;
                }
            }
        }
    }

    /**
     * INPUT.
     *
     * Reads one line, splits it on commas, and assigns. Three things
     * can go wrong, and BASIC has a distinct answer for each:
     *
     *   - too few values      -> "?? " and read another line, appending
     *   - a value of the wrong kind -> "?REDO FROM START", ask again
     *   - too many values     -> "?EXTRA IGNORED", carry on
     *
     * Breaking out (Ctrl+C) stops the program rather than assigning.
     */
    private async executeInput(statement: Extract<Statement, { kind: "input" }>) {
        const prompt = statement.prompt + (statement.showQuestionMark ? "? " : "");

        for (;;) {
            const line = await this.console.readLine(prompt);
            if (line === null) return this.breakOut();

            let fields = splitInputFields(line);

            /* Not enough yet: keep asking, with the continuation prompt,
             * rather than starting over. */
            while (fields.length < statement.targets.length) {
                const more = await this.console.readLine("?? ");
                if (more === null) return this.breakOut();
                fields = fields.concat(splitInputFields(more));
            }

            if (fields.length > statement.targets.length) {
                this.console.write("?EXTRA IGNORED\n");
            }

            const values = this.convertInputFields(statement.targets, fields);
            if (values === null) {
                this.console.write("?REDO FROM START\n");
                continue;
            }

            for (let i = 0; i < statement.targets.length; i += 1) {
                this.assign(statement.targets[i], values[i]);
            }
            return;
        }
    }

    /** Null if any field is the wrong kind for its variable. */
    private convertInputFields(targets: LValue[], fields: string[]): Value[] | null {
        const values: Value[] = [];

        for (let i = 0; i < targets.length; i += 1) {
            const target = targets[i];
            const field = fields[i];

            if (this.variables.getType(target.name, target.sigil) === "string") {
                values.push(field);
                continue;
            }

            const number = parseInputNumber(field);
            if (number === null) return null;
            values.push(number);
        }

        return values;
    }

    private async executeLineInput(
        statement: Extract<Statement, { kind: "lineInput" }>,
    ) {
        const line = await this.console.readLine(statement.prompt);
        if (line === null) return this.breakOut();
        this.assign(statement.target, line);
    }

    private executeRead(statement: Extract<Statement, { kind: "read" }>) {
        for (const target of statement.targets) {
            const item = this.nextDataItem();

            if (this.variables.getType(target.name, target.sigil) === "string") {
                this.assign(target, item.value);
                continue;
            }

            const number = parseInputNumber(item.value);
            /* A word where a number was wanted is a fault in the DATA,
             * so it is reported as a syntax error, not a type mismatch. */
            if (number === null) throw new BasicError("SYNTAX");
            this.assign(target, number);
        }
    }

    /**
     * Walks forward to the next unread DATA item.
     *
     * The pointer is a position in the *program*, not an index into a
     * flattened list, so DATA statements are found where they lie and
     * nothing has to be gathered up in advance.
     */
    private nextDataItem(): DataItem {
        const at = this.dataPointer;

        for (;;) {
            const line = this.program.at(at.lineIndex);
            if (line === null) throw new BasicError("OUT OF DATA");

            const statements = this.program.statementsOf(line);
            if (at.statementIndex >= statements.length) {
                at.lineIndex += 1;
                at.statementIndex = 0;
                at.itemIndex = 0;
                continue;
            }

            const statement = statements[at.statementIndex];
            if (statement.kind !== "data" || at.itemIndex >= statement.items.length) {
                at.statementIndex += 1;
                at.itemIndex = 0;
                continue;
            }

            const item = statement.items[at.itemIndex];
            at.itemIndex += 1;
            return item;
        }
    }

    private executeRestore(statement: Extract<Statement, { kind: "restore" }>) {
        const lineIndex =
            statement.line === null ? 0 : this.program.findIndex(statement.line);
        if (lineIndex === null) throw new BasicError("UNDEF'D STATEMENT");
        this.dataPointer = { lineIndex, statementIndex: 0, itemIndex: 0 };
    }

    /**
     * Waits, in slices, so that a long DELAY can still be interrupted.
     * A program that asks to sleep for a minute should not lock the
     * user out for a minute.
     */
    private async delay(milliseconds: number) {
        let remaining = Math.max(0, milliseconds);

        do {
            const slice = Math.min(remaining, BREAK_CHECK_SLICE_MS);
            await this.console.wait(slice);
            remaining -= slice;

            if (this.console.checkBreak()) {
                this.breakOut();
                return;
            }
        } while (remaining > 0);
    }

    /** Stops the program where it stands, leaving CONT able to resume. */
    private breakOut() {
        this.continuePosition = { ...this.position };
        this.stopped = true;
        this.console.write(
            this.runningLine === null ? "Break\n" : `Break in ${this.runningLine}\n`,
        );
    }

    /**
     * RENUM.
     *
     * Renumbering is the easy half; the work is that every *reference*
     * to a line has to move with it -- GOTO, GOSUB, THEN, ELSE, ON…GOTO,
     * RESTORE. Those are found by the one shared rule in
     * `lineReferences.ts' and spliced into each line's stored source at
     * the exact characters they occupied, so spacing survives.
     */
    private executeRenum(statement: Extract<Statement, { kind: "renum" }>) {
        const newStart = statement.newStart ?? 10;
        const increment = statement.increment ?? 10;
        const oldStart = statement.oldStart ?? 0;

        if (increment < 1 || newStart < 0) {
            throw new BasicError("ILLEGAL QUANTITY");
        }

        const lines = this.program.list(null, null);
        const kept = lines.filter((line) => line.number < oldStart);
        const moving = lines.filter((line) => line.number >= oldStart);

        /* Renumbering must not shuffle the program's order. */
        const lastKept = kept[kept.length - 1];
        if (lastKept !== undefined && lastKept.number >= newStart) {
            throw new BasicError("ILLEGAL QUANTITY");
        }
        if (
            moving.length > 0 &&
            newStart + (moving.length - 1) * increment > MAX_LINE_NUMBER
        ) {
            throw new BasicError("ILLEGAL QUANTITY");
        }

        const map = new Map<number, number>();
        for (const line of kept) map.set(line.number, line.number);
        moving.forEach((line, index) => {
            map.set(line.number, newStart + index * increment);
        });

        const rewritten = lines.map((line) => {
            const result = rewriteLineReferences(line.source, map);
            for (const target of result.missing) {
                this.console.write(
                    `?UNDEFINED LINE ${target} IN ${map.get(line.number)}\n`,
                );
            }
            return { number: map.get(line.number)!, source: result.source };
        });

        this.program.clear();
        for (const line of rewritten) this.program.setLine(line.number, line.source);
        this.continuePosition = null;
    }

    /**
     * `MID$(A$,n,m) = B$' overwrites in place: the string keeps exactly
     * the length it had, and only as many characters as will fit are
     * taken from the replacement.
     */
    private executeMidAssign(statement: Extract<Statement, { kind: "midAssign" }>) {
        const text = asString(this.read(statement.target));
        const start = Math.trunc(this.number(statement.start));
        if (start < 1) throw new BasicError("ILLEGAL QUANTITY");

        const replacement = asString(this.evaluator.evaluate(statement.value));
        const room = Math.min(
            text.length - (start - 1),
            statement.length === null
                ? replacement.length
                : Math.trunc(this.number(statement.length)),
            replacement.length,
        );
        if (room <= 0) return;

        this.assign(
            statement.target,
            text.slice(0, start - 1) +
                replacement.slice(0, room) +
                text.slice(start - 1 + room),
        );
    }

    private executeSwap(statement: Extract<Statement, { kind: "swap" }>) {
        const left = this.read(statement.left);
        const right = this.read(statement.right);
        this.assign(statement.left, right);
        this.assign(statement.right, left);
    }

    private read(target: LValue): Value {
        if (target.kind === "variable") {
            return this.variables.getScalar(target.name, target.sigil);
        }
        return this.variables.getElement(
            target.name,
            target.sigil,
            target.subscripts.map((subscript) => this.number(subscript)),
        );
    }

    private assign(target: LValue, value: Value) {
        if (target.kind === "variable") {
            this.variables.setScalar(target.name, target.sigil, value);
            return;
        }
        this.variables.setElement(
            target.name,
            target.sigil,
            target.subscripts.map((subscript) => this.number(subscript)),
            value,
        );
    }

    private print(statement: Extract<Statement, { kind: "print" }>) {
        for (const item of statement.items) {
            switch (item.kind) {
                case "expression":
                    this.console.write(formatValue(this.evaluator.evaluate(item.expr)));
                    break;

                case "adjacent":
                    /* A semicolon deliberately does nothing. */
                    break;

                case "zone":
                    this.advanceToZone();
                    break;

                case "tab":
                    this.padTo(this.number(item.expr) - 1);
                    break;

                case "spc":
                    this.console.write(" ".repeat(Math.max(0, this.number(item.expr))));
                    break;
            }
        }

        if (statement.newline) this.console.write("\n");
    }

    /**
     * A comma moves to the next 14-column zone, or to the next line if
     * there is no room for another zone on this one.
     */
    private advanceToZone() {
        const column = this.console.getColumn();
        const target = (Math.floor(column / PRINT_ZONE_WIDTH) + 1) * PRINT_ZONE_WIDTH;

        if (target >= this.console.getWidth()) {
            this.console.write("\n");
            return;
        }
        this.console.write(" ".repeat(target - column));
    }

    /** TAB never moves backwards; if we are already past, it does nothing. */
    private padTo(column: number) {
        const current = this.console.getColumn();
        if (column > current) this.console.write(" ".repeat(column - current));
    }

    private number(expr: Expr): number {
        return asNumber(this.evaluator.evaluate(expr));
    }
}

function sameVariable(a: LoopVariable, b: LoopVariable): boolean {
    return a.name === b.name && a.sigil === b.sigil;
}
