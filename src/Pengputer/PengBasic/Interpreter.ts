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
import { BasicError, errorKindForCode, isBasicError } from "./errors";
import { applyBinary, Evaluator, type Builtins } from "./Evaluator";
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
    CaseClause,
    ComparisonOp,
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

const DEFAULT_PROGRAM_FILENAME = "PROGRAM.BAS";

/**
 * Stack limits.
 *
 * A real machine had a few hundred bytes for these and said
 * `?OUT OF MEMORY' when they filled. We have no such wall, so
 * `10 GOSUB 10' would grow the return stack until the tab died --
 * which is a mistyped listing turning into a hung browser instead of
 * an error you can read. Generous enough that no sane program notices.
 */
const MAX_GOSUB_DEPTH = 1000;
const MAX_LOOP_DEPTH = 256;

const LIST_MORE_PROMPT = "-- MORE --";

function yieldToHost(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Where execution is: which line, and which statement within it. */
interface Position {
    lineIndex: number;
    statementIndex: number;
}

/**
 * The `lineIndex' of statements typed at the prompt.
 *
 * Direct-mode statements are not in the program, but they still need a
 * position so that FOR/NEXT and the block constructs work on one typed
 * line the way they do in a listing -- `FOR I=1 TO 3: PRINT I;: NEXT I'
 * at the prompt is a loop, and always was.
 */
const DIRECT_LINE = -1;

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
 * One active DO.
 *
 * `test' is the condition written on the DO itself, which LOOP re-tests
 * on the way round -- the same arrangement WHILE and WEND use, and for
 * the same reason: jumping back to the body rather than to the DO means
 * the DO never runs twice and never pushes a second frame.
 */
interface DoFrame {
    resume: Position;
    test: Expr | null;
    until: boolean;
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

    /**
     * The three block constructs.
     *
     * Each is a stack because they nest, and each frame holds the one
     * fact its closing statements need. `taken' and `matched' are the
     * same idea twice: once a branch has run, everything else in the
     * construct has to be skipped rather than tested, and reaching a
     * later `ELSEIF' or `CASE' means falling out of a branch that did
     * run rather than looking for one that should.
     */
    private ifStack: { taken: boolean }[] = [];
    private selectStack: { value: Value; matched: boolean }[] = [];
    private doStack: DoFrame[] = [];

    /**
     * Error trapping.
     *
     * `errorHandler' is the line ON ERROR named, or null for the normal
     * behaviour of reporting and stopping.
     *
     * `errorReturn' is where to go back to, and it doubles as the flag
     * for "a handler is running": while it is set, trapping is
     * suspended, so a mistake inside a handler is reported instead of
     * sending the program round the same loop forever.
     *
     * `lastError' outlives both, because ERR and ERL keep answering
     * after RESUME has been and gone.
     */
    /** What was typed at the prompt, while it is running. */
    private directStatements: Statement[] = [];

    private errorHandler: number | null = null;
    private errorReturn: Position | null = null;
    private lastError: { error: BasicError; line: number } | null = null;

    /** Set by STOP, consumed by CONT. */
    private continuePosition: Position | null = null;

    /** Where the last error happened, for a bare EDIT. */
    private lastErrorLine: number | null = null;

    private tracing: boolean = false;

    /** Walks the program's DATA statements in line order. */
    private dataPointer: DataPointer = {
        lineIndex: 0,
        statementIndex: 0,
        itemIndex: 0,
    };

    constructor(
        machine: Console,
        builtins?: Builtins,
        now: () => Date = () => new Date(),
    ) {
        this.console = machine;
        this.evaluator = new Evaluator(
            this.variables,
            builtins ??
                createBuiltins({
                    machine,
                    random: this.random,
                    now,
                    lastError: () => this.errorInfo(),
                }),
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
        try {
            return await this.runLine(source);
        } catch (e) {
            /* Remember where it went wrong, so a bare EDIT can offer
             * that line back. */
            if (isBasicError(e)) this.lastErrorLine = this.runningLine;
            throw e;
        }
    }

    private async runLine(source: string): Promise<LineOutcome> {
        this.runningLine = null;

        const tokens = tokenize(source);
        const first = tokens[0];

        if (first.kind === "number") {
            if (
                !Number.isInteger(first.value) ||
                first.value < 0 ||
                first.value > MAX_LINE_NUMBER
            ) {
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

        return await this.runDirect(new StatementParser(tokens).parseLine());
    }

    /**
     * Runs what was typed, through the same position-driven loop a
     * stored program uses.
     *
     * A statement that jumps into the program -- RUN, or a GOTO --
     * moves `lineIndex' away from DIRECT_LINE, and that is what ends
     * this loop rather than any special case for those statements.
     */
    private async runDirect(statements: Statement[]): Promise<LineOutcome> {
        this.directStatements = statements;
        this.position = { lineIndex: DIRECT_LINE, statementIndex: 0 };

        while (
            this.position.lineIndex === DIRECT_LINE &&
            this.position.statementIndex < statements.length
        ) {
            const statement = statements[this.position.statementIndex];
            this.position.statementIndex += 1;
            await this.execute(statement);
        }
        return "executed";
    }

    /** The statements of a line, or of what was typed. */
    private statementsAt(lineIndex: number): Statement[] | null {
        if (lineIndex === DIRECT_LINE) return this.directStatements;
        const line = this.program.at(lineIndex);
        return line === null ? null : this.program.statementsOf(line);
    }

    private async runProgram() {
        /*
         * RUN restarts the random sequence, so an unseeded program deals
         * the same cards every time it is run. That is not an oversight
         * in the original and it is not one here: it is why every
         * listing that wants variety opens with RANDOMIZE, and why the
         * ones that forget are famously predictable.
         */
        this.random.reset();

        this.variables.clear();
        this.functions.clear();
        this.returnStack = [];
        this.forStack = [];
        this.whileStack = [];
        this.ifStack = [];
        this.selectStack = [];
        this.doStack = [];
        this.errorHandler = null;
        this.errorReturn = null;
        this.lastError = null;
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

            /* Where to come back to if this statement fails. Taken
             * before the step, because RESUME retries the statement
             * rather than the one after it. */
            const failedAt: Position = {
                lineIndex: this.position.lineIndex,
                statementIndex: this.position.statementIndex,
            };

            const statement = statements[this.position.statementIndex];
            this.position.statementIndex += 1;

            try {
                await this.execute(statement);
            } catch (e) {
                if (!this.trapError(e, line.number, failedAt)) throw e;
            }

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
    /**
     * Hands an error to `ON ERROR GOTO', if there is one to hand it to.
     *
     * Answers whether it was taken. False means the caller should let
     * the error carry on out and be reported, which covers three cases:
     * it is not a BASIC error at all, no handler is installed, or a
     * handler is already running and this error is its own.
     */
    private trapError(
        e: unknown,
        lineNumber: number,
        failedAt: Position,
    ): boolean {
        if (!isBasicError(e)) return false;
        if (this.errorHandler === null || this.errorReturn !== null) {
            return false;
        }

        /* Jump first: if the handler line does not exist that is the
         * error worth reporting, and nothing has been disturbed yet. */
        this.jumpTo(this.errorHandler);
        this.lastError = { error: e, line: lineNumber };
        this.errorReturn = failedAt;
        return true;
    }

    /** What ERR and ERL answer. Both are 0 before anything has failed. */
    private errorInfo(): { code: number; line: number } {
        if (this.lastError === null) return { code: 0, line: 0 };
        return { code: this.lastError.error.code, line: this.lastError.line };
    }

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
                this.assign(
                    statement.target,
                    this.evaluator.evaluate(statement.value),
                );
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

            case "erase":
                for (const entry of statement.names) {
                    this.variables.eraseArray(entry.name, entry.sigil);
                }
                return;

            case "redim":
                for (const entry of statement.entries) {
                    /* Unlike DIM this may replace, so anything already
                     * there goes first -- and its contents with it. */
                    if (this.variables.hasArray(entry.name, entry.sigil)) {
                        this.variables.eraseArray(entry.name, entry.sigil);
                    }
                    this.variables.dimension(
                        entry.name,
                        entry.sigil,
                        entry.bounds.map((bound) => this.number(bound)),
                    );
                }
                return;

            case "const":
                for (const entry of statement.entries) {
                    this.variables.defineConstant(
                        entry.name,
                        entry.sigil,
                        this.evaluator.evaluate(entry.value),
                    );
                }
                return;

            case "optionBase":
                this.variables.setOptionBase(statement.base === 1 ? 1 : 0);
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
                if (this.returnStack.length >= MAX_GOSUB_DEPTH) {
                    throw new BasicError("OUT OF MEMORY");
                }
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

            case "blockIf": {
                if (this.ifStack.length >= MAX_LOOP_DEPTH) {
                    throw new BasicError("OUT OF MEMORY");
                }
                const taken = this.truth(statement.condition);
                this.ifStack.push({ taken });
                /* Taken: carry straight on into the body. Not taken:
                 * land on whichever ELSEIF, ELSE or END IF comes next
                 * and let that statement decide. */
                if (!taken) this.jumpToBlockBranch("if");
                return;
            }

            case "elseIf": {
                const frame = this.ifStack[this.ifStack.length - 1];
                if (!frame) throw new BasicError("SYNTAX");
                /* Arriving here having already run a branch means we
                 * fell out of the end of it. */
                if (frame.taken) {
                    this.skipPastBlockEnd("if");
                    return;
                }
                frame.taken = this.truth(statement.condition);
                if (!frame.taken) this.jumpToBlockBranch("if");
                return;
            }

            case "blockElse": {
                const frame = this.ifStack[this.ifStack.length - 1];
                if (!frame) throw new BasicError("SYNTAX");
                if (frame.taken) {
                    this.skipPastBlockEnd("if");
                    return;
                }
                frame.taken = true;
                return;
            }

            case "endIf":
                if (this.ifStack.pop() === undefined) {
                    throw new BasicError("SYNTAX");
                }
                return;

            case "selectCase": {
                if (this.selectStack.length >= MAX_LOOP_DEPTH) {
                    throw new BasicError("OUT OF MEMORY");
                }
                this.selectStack.push({
                    /* Worked out once, here, so a selector with a side
                     * effect or a cost is not paid per CASE. */
                    value: this.evaluator.evaluate(statement.selector),
                    matched: false,
                });
                this.jumpToBlockBranch("select");
                return;
            }

            case "case": {
                const frame = this.selectStack[this.selectStack.length - 1];
                if (!frame) throw new BasicError("SYNTAX");
                if (frame.matched) {
                    this.skipPastBlockEnd("select");
                    return;
                }
                if (this.caseMatches(frame.value, statement.clauses)) {
                    frame.matched = true;
                    return;
                }
                this.jumpToBlockBranch("select");
                return;
            }

            case "caseElse": {
                const frame = this.selectStack[this.selectStack.length - 1];
                if (!frame) throw new BasicError("SYNTAX");
                if (frame.matched) {
                    this.skipPastBlockEnd("select");
                    return;
                }
                frame.matched = true;
                return;
            }

            case "endSelect":
                if (this.selectStack.pop() === undefined) {
                    throw new BasicError("SYNTAX");
                }
                return;

            case "do": {
                if (this.doStack.length >= MAX_LOOP_DEPTH) {
                    throw new BasicError("OUT OF MEMORY");
                }
                if (statement.test !== null && !this.loopGoesOn(statement)) {
                    this.skipPastBlockEnd("do");
                    return;
                }
                this.doStack.push({
                    resume: { ...this.position },
                    test: statement.test,
                    until: statement.until,
                });
                return;
            }

            case "loop": {
                const frame = this.doStack[this.doStack.length - 1];
                if (!frame) throw new BasicError("LOOP WITHOUT DO");

                /* A test at both ends is two answers to one question.
                 * QuickBASIC reports it as an unmatched LOOP, which is
                 * how its parser sees it: a DO carrying a test expects
                 * a bare LOOP, so a LOOP carrying one closes nothing. */
                if (statement.test !== null && frame.test !== null) {
                    throw new BasicError("LOOP WITHOUT DO");
                }

                const test = statement.test !== null ? statement : frame;
                if (test.test === null || this.loopGoesOn(test)) {
                    this.position = { ...frame.resume };
                    return;
                }
                this.doStack.pop();
                return;
            }

            case "exit":
                if (statement.what === "do") {
                    if (this.doStack.pop() === undefined) {
                        throw new BasicError("SYNTAX");
                    }
                    this.skipPastBlockEnd("do");
                    return;
                }
                if (this.forStack.pop() === undefined) {
                    throw new BasicError("NEXT WITHOUT FOR");
                }
                this.skipPastBlockEnd("for");
                return;

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
                for (const line of this.program.list(
                    statement.from,
                    statement.to,
                )) {
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
                /* Bare EDIT means "the one that just went wrong", which
                 * is almost always what you want after an error. */
                const wanted = statement.line ?? this.lastErrorLine;
                if (wanted === null) throw new BasicError("UNDEF'D STATEMENT");

                const line = this.program.at(
                    this.program.findIndex(wanted) ?? -1,
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

            case "download": {
                const filename =
                    statement.filename === null
                        ? DEFAULT_PROGRAM_FILENAME
                        : asString(this.evaluator.evaluate(statement.filename));
                await this.console.download(filename, this.getProgramText());
                return;
            }

            case "upload":
                await this.executeUpload();
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

                if (statement.cursor !== null) {
                    const visible = Math.trunc(this.number(statement.cursor));
                    if (visible !== 0 && visible !== 1) {
                        throw new BasicError("ILLEGAL QUANTITY");
                    }
                    this.console.setCursorVisible(visible === 1);
                }
                return;
            }

            case "color": {
                const pick = (expr: Expr | null, highest: number) => {
                    if (expr === null) return null;
                    const index = Math.trunc(this.number(expr));
                    if (index < 0 || index > highest) {
                        throw new BasicError("ILLEGAL QUANTITY");
                    }
                    return index;
                };

                /* CGA put blink in the top bit of the foreground, so
                 * COLOR 30 is blinking yellow rather than a 31st
                 * colour. Sixteen colours and a flag, in one number. */
                const foreground = pick(statement.foreground, 31);
                this.console.setColor(
                    foreground === null ? null : foreground % 16,
                    pick(statement.background, 15),
                    foreground === null ? null : foreground >= 16,
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
                /* A bare RANDOMIZE stops and asks, which is how a
                 * listing gets a different game without knowing what
                 * the clock is: the person at the keyboard supplies the
                 * variety. Taking the time instead would be a kindness
                 * the original never offered. */
                this.random.seed(
                    statement.seed === null
                        ? await this.askForSeed()
                        : this.number(statement.seed),
                );
                return;

            case "printUsing": {
                const format = asString(
                    this.evaluator.evaluate(statement.format),
                );
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
                this.functions.set(
                    definition.name + definition.sigil,
                    definition,
                );
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
                /* Evaluated for their errors, then discarded: there is
                 * no fixed string space here to reserve. */
                if (statement.stringSpace !== null)
                    this.number(statement.stringSpace);
                if (statement.stackSpace !== null)
                    this.number(statement.stackSpace);
                this.variables.clear();
                this.functions.clear();
                return;

            case "list":
                await this.executeList(statement);
                return;

            case "onError":
                if (statement.line !== 0) {
                    this.errorHandler = statement.line;
                    return;
                }
                this.errorHandler = null;
                /* Inside a handler, turning trapping off is how a
                 * program says it cannot deal with this one after all,
                 * and the error it was given is reported as though it
                 * had never been caught. */
                if (this.errorReturn !== null && this.lastError !== null) {
                    this.errorReturn = null;
                    throw this.lastError.error;
                }
                return;

            case "resume": {
                if (this.errorReturn === null) {
                    throw new BasicError("RESUME WITHOUT ERROR");
                }
                const back = this.errorReturn;
                this.errorReturn = null;

                if (statement.target === "same") {
                    this.position = { ...back };
                } else if (statement.target === "next") {
                    /* One past the end of a line is fine: the main loop
                     * treats that as "move to the next line". */
                    this.position = {
                        lineIndex: back.lineIndex,
                        statementIndex: back.statementIndex + 1,
                    };
                } else {
                    this.jumpTo(statement.target);
                }
                return;
            }

            case "error": {
                const code = Math.trunc(this.number(statement.code));
                if (code < 0 || code > 255) {
                    throw new BasicError("ILLEGAL QUANTITY");
                }
                throw new BasicError(errorKindForCode(code), null, code);
            }
        }

        /* Adding a statement kind and forgetting to run it used to
         * compile cleanly and then quietly do nothing. This makes that
         * a type error at the point the kind is added. */
        const unhandled: never = statement;
        throw new Error(`unhandled statement: ${JSON.stringify(unhandled)}`);
    }

    private async executeIf(statement: Extract<Statement, { kind: "if" }>) {
        const taken =
            asNumber(this.evaluator.evaluate(statement.condition)) !== 0;
        const branch = taken ? statement.then : statement.else;
        if (branch === null) return;

        for (const inner of branch) {
            await this.execute(inner);
            /* A jump inside the branch abandons the rest of it. */
            if (this.stopped) return;
        }
    }

    /**
     * FOR sets the counter, tests the limit, and remembers where the
     * body starts. NEXT tests it again on the way round; the test here
     * is what makes `FOR I=1 TO 0' run nothing at all.
     */
    private executeFor(statement: Extract<Statement, { kind: "for" }>) {
        const { variable } = statement;

        this.variables.setScalar(
            variable.name,
            variable.sigil,
            this.number(statement.from),
        );

        const step = statement.step === null ? 1 : this.number(statement.step);
        const limit = this.number(statement.to);

        /* Re-entering a loop with the same counter replaces it rather
         * than nesting -- otherwise a GOTO back to a FOR leaks a frame
         * every time round, and book programs do that constantly. */
        const existing = this.forStack.findIndex((frame) =>
            sameVariable(frame.variable, variable),
        );
        if (existing >= 0) this.forStack.length = existing;

        /*
         * The limit is tested *here*, before the body, so `FOR I=1 TO 0'
         * runs nothing at all and leaves I as 1. Testing it at the NEXT
         * instead -- which is what this did until GW-BASIC said
         * otherwise -- runs the body once, and any listing whose count
         * can come out zero then does one iteration too many.
         *
         * The counter is read back rather than used directly, because
         * storing it may have narrowed it: `FOR I%=1.6 TO 2' starts at
         * 2, not 1.6.
         */
        const start = asNumber(
            this.variables.getScalar(variable.name, variable.sigil),
        );
        if (step >= 0 ? start > limit : start < limit) {
            this.skipPastBlockEnd("for");
            return;
        }

        if (this.forStack.length >= MAX_LOOP_DEPTH) {
            throw new BasicError("OUT OF MEMORY");
        }
        this.forStack.push({
            variable,
            limit,
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
            while (
                index >= 0 &&
                !sameVariable(this.forStack[index].variable, variable)
            ) {
                index -= 1;
            }
        }
        if (index < 0) throw new BasicError("NEXT WITHOUT FOR");

        this.forStack.length = index + 1;
        const frame = this.forStack[index];

        const next =
            asNumber(
                this.variables.getScalar(
                    frame.variable.name,
                    frame.variable.sigil,
                ),
            ) + frame.step;
        this.variables.setScalar(
            frame.variable.name,
            frame.variable.sigil,
            next,
        );

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
            if (this.whileStack.length >= MAX_LOOP_DEPTH) {
                throw new BasicError("OUT OF MEMORY");
            }
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
     * The shape of each block construct, for the forward scanner.
     *
     * `opens' and `closes' are what nest; `branches' are the statements
     * that end a scan without closing anything -- ELSEIF and CASE,
     * which are where a branch that was not taken lands. Each construct
     * counts only its own kinds, which is why a SELECT CASE inside an
     * IF does not confuse the search for that IF's ELSE.
     */
    private static readonly BLOCKS = {
        if: {
            opens: "blockIf",
            closes: "endIf",
            branches: ["elseIf", "blockElse"],
            unclosed: "SYNTAX",
        },
        select: {
            opens: "selectCase",
            closes: "endSelect",
            branches: ["case", "caseElse"],
            unclosed: "SYNTAX",
        },
        do: {
            opens: "do",
            closes: "loop",
            branches: [],
            unclosed: "SYNTAX",
        },
        for: {
            opens: "for",
            closes: "next",
            branches: [],
            unclosed: "NEXT WITHOUT FOR",
        },
        while: {
            opens: "while",
            closes: "wend",
            branches: [],
            unclosed: "WHILE WITHOUT WEND",
        },
    } as const;

    /**
     * Walks forward from where we stand to the statement that closes,
     * or next branches, the block we are inside -- counting nesting.
     *
     * Answers the position *of* that statement. Whether to run it or
     * step over it is the caller's business, and the two callers below
     * want different things.
     */
    private scanForward(
        block: keyof typeof Interpreter.BLOCKS,
        stopAtBranches: boolean,
    ): Position {
        const shape = Interpreter.BLOCKS[block];
        const branches = stopAtBranches
            ? (shape.branches as readonly string[])
            : [];
        const at: Position = { ...this.position };
        let depth = 1;

        for (;;) {
            const statements = this.statementsAt(at.lineIndex);
            if (statements === null) throw new BasicError(shape.unclosed);

            if (at.statementIndex >= statements.length) {
                /* A typed line does not continue onto the next one. */
                if (at.lineIndex === DIRECT_LINE) {
                    throw new BasicError(shape.unclosed);
                }
                at.lineIndex += 1;
                at.statementIndex = 0;
                continue;
            }

            const kind = statements[at.statementIndex].kind;

            if (depth === 1 && branches.includes(kind)) return { ...at };

            at.statementIndex += 1;

            if (kind === shape.opens) depth += 1;
            else if (kind === shape.closes) {
                depth -= 1;
                if (depth === 0)
                    return {
                        lineIndex: at.lineIndex,
                        statementIndex: at.statementIndex - 1,
                    };
            }
        }
    }

    /**
     * Lands *on* the next ELSEIF / ELSE / CASE / closing statement, for
     * a branch that was not taken -- that statement then decides.
     */
    private jumpToBlockBranch(block: "if" | "select") {
        this.position = this.scanForward(block, true);
    }

    /**
     * Lands just *past* the statement that closes the block, for a
     * branch that has run and an EXIT.
     *
     * Branch points are ignored here, which is the difference from the
     * method above and the whole reason the flag exists: falling out of
     * a matched CASE has to reach END SELECT, not the next CASE.
     */
    private skipPastBlockEnd(block: keyof typeof Interpreter.BLOCKS) {
        const at = this.scanForward(block, false);
        this.position = {
            lineIndex: at.lineIndex,
            statementIndex: at.statementIndex + 1,
        };
    }

    private skipPastWend() {
        this.skipPastBlockEnd("while");
    }

    /** A condition, as BASIC means it: anything but zero is true. */
    private truth(expr: Expr): boolean {
        return asNumber(this.evaluator.evaluate(expr)) !== 0;
    }

    /** Does a DO or LOOP test say to go round again? */
    private loopGoesOn(test: { test: Expr | null; until: boolean }): boolean {
        if (test.test === null) return true;
        const value = this.truth(test.test);
        return test.until ? !value : value;
    }

    /** Does any clause of one CASE match the selector? */
    private caseMatches(value: Value, clauses: CaseClause[]): boolean {
        const compare = (op: ComparisonOp, right: Expr) =>
            asNumber(applyBinary(op, value, this.evaluator.evaluate(right))) !==
            0;

        return clauses.some((clause) => {
            if (clause.kind === "value") return compare("=", clause.value);
            if (clause.kind === "compare") {
                return compare(clause.op, clause.value);
            }
            return compare(">=", clause.from) && compare("<=", clause.to);
        });
    }

    /**
     * INPUT.
     *
     * Reads one line, splits it on commas, and assigns.
     *
     * Anything at all wrong with the answer -- too few values, too
     * many, or one of the wrong kind -- throws the whole line away,
     * prints "?REDO FROM START" and asks again unchanged. That is one
     * rule rather than the three this originally had, and it is what
     * GW-BASIC does: there is no continuation prompt for a short
     * answer and no forgiveness for a long one.
     *
     * The case that looks like "too few" and is not: an empty line is
     * one empty field, so Enter at `INPUT A' gives 0.
     *
     * Breaking out (Ctrl+C) stops the program rather than assigning.
     */
    private async executeInput(
        statement: Extract<Statement, { kind: "input" }>,
    ) {
        const prompt =
            statement.prompt + (statement.showQuestionMark ? "? " : "");

        for (;;) {
            const line = await this.console.readLine(prompt);
            if (line === null) return this.breakOut();

            const fields = splitInputFields(line);

            if (fields.length !== statement.targets.length) {
                this.console.write("?REDO FROM START\n");
                continue;
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

    /**
     * The prompt a bare RANDOMIZE puts up.
     *
     * Upper case, like every other message this machine prints -- GW
     * spells it in mixed case, and the rest of the house style is
     * settled the other way (§7.2). The range in the text is the range
     * of a 16-bit integer, which is what the original would take.
     */
    private async askForSeed(): Promise<number> {
        for (;;) {
            const line = await this.console.readLine(
                "RANDOM NUMBER SEED (-32768 TO 32767)? ",
            );
            if (line === null) {
                this.breakOut();
                return 0;
            }

            const seed = parseInputNumber(line.trim());
            if (seed !== null) return seed;
            this.console.write("?REDO FROM START\n");
        }
    }

    /** Null if any field is the wrong kind for its variable. */
    private convertInputFields(
        targets: LValue[],
        fields: string[],
    ): Value[] | null {
        const values: Value[] = [];

        for (let i = 0; i < targets.length; i += 1) {
            const target = targets[i];
            const field = fields[i];

            if (
                this.variables.getType(target.name, target.sigil) === "string"
            ) {
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

            if (
                this.variables.getType(target.name, target.sigil) === "string"
            ) {
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
            if (
                statement.kind !== "data" ||
                at.itemIndex >= statement.items.length
            ) {
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
            statement.line === null
                ? 0
                : this.program.findIndex(statement.line);
        if (lineIndex === null) throw new BasicError("UNDEF'D STATEMENT");
        this.dataPointer = { lineIndex, statementIndex: 0, itemIndex: 0 };
    }

    /**
     * LIST, a screenful at a time.
     *
     * A sixty-line program does not fit a twenty-five-line screen, and
     * without pausing the top of it is gone before you can read it.
     * The page size comes from the console, so it is right in whichever
     * screen mode the machine happens to be in.
     *
     * Not something Microsoft did -- there you held Ctrl+S. This is the
     * more useful behaviour and the less authentic one.
     */
    private async executeList(statement: Extract<Statement, { kind: "list" }>) {
        const lines = this.program.list(statement.from, statement.to);
        /* One row short of the screen, leaving room for the prompt. */
        const perPage = Math.max(1, this.console.getHeight() - 1);

        for (let i = 0; i < lines.length; i += 1) {
            if (i > 0 && i % perPage === 0) {
                this.console.write(LIST_MORE_PROMPT);
                const key = await this.console.waitForKey();

                const blank = " ".repeat(LIST_MORE_PROMPT.length);
                this.console.write(`\r${blank}\r`);

                if (key === "\x03") return;
            }
            this.console.write(`${lines[i].number} ${lines[i].source}\n`);
        }
    }

    /** The program as LIST would show it, which is what DOWNLOAD saves. */
    private getProgramText(): string {
        return this.program
            .list(null, null)
            .map((line) => `${line.number} ${line.source}\n`)
            .join("");
    }

    /**
     * Reads a file in exactly as pasting it would, after a NEW.
     *
     * Feeding the lines through executeLine rather than storing them
     * directly means an uploaded file behaves identically to a pasted
     * one, down to which lines are stored and which are obeyed -- one
     * path, not two that can disagree.
     */
    private async executeUpload() {
        const contents = await this.console.upload();
        if (contents === null) return;

        this.program.clear();
        this.variables.clear();
        this.functions.clear();
        this.continuePosition = null;

        for (const line of contents.split("\n")) {
            if (line.trim().length === 0) continue;
            await this.executeLine(line);
        }

        /* The program that was running has just been replaced. */
        if (this.runningLine !== null) this.stopped = true;
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
            this.runningLine === null
                ? "Break\n"
                : `Break in ${this.runningLine}\n`,
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
        for (const line of rewritten)
            this.program.setLine(line.number, line.source);
        this.continuePosition = null;
    }

    /**
     * `MID$(A$,n,m) = B$' overwrites in place: the string keeps exactly
     * the length it had, and only as many characters as will fit are
     * taken from the replacement.
     */
    private executeMidAssign(
        statement: Extract<Statement, { kind: "midAssign" }>,
    ) {
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
                case "expression": {
                    /* Typed, because how many digits a number shows is
                     * a property of the expression's width, not of the
                     * value: a double prints sixteen where a single
                     * prints six. */
                    const { value, type } = this.evaluator.evaluateTyped(
                        item.expr,
                    );
                    this.console.write(formatValue(value, type));
                    break;
                }

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
                    this.console.write(
                        " ".repeat(Math.max(0, this.number(item.expr))),
                    );
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
        const target =
            (Math.floor(column / PRINT_ZONE_WIDTH) + 1) * PRINT_ZONE_WIDTH;

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
