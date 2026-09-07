/**
 * Parsing statements, on top of the expression parser from stage 2.
 *
 * A line is statements separated by ":". Each statement is decided by
 * its first token, with one special case that is not a keyword at all:
 * a line starting with a variable name is an assignment, because `LET'
 * is optional and almost nobody wrote it.
 */
import { BasicError } from "./errors";
import { Parser, userFunctionName } from "./Parser";
import { tokenize } from "./Tokenizer";
import type {
    DataItem,
    Expr,
    LetterRange,
    DimEntry,
    LoopVariable,
    LValue,
    PrintItem,
    Statement,
} from "./ast";
import type { Keyword, Punct, Sigil, Token } from "./tokens";

export class StatementParser extends Parser {
    /** Every statement on one line. */
    parseLine(): Statement[] {
        const statements: Statement[] = [];

        for (;;) {
            /* ":::" is legal and means nothing. */
            while (this.takePunct(":")) continue;

            if (this.peek().kind === "end") break;

            statements.push(this.parseStatement());

            const token = this.peek();
            if (token.kind === "end") break;
            if (token.kind === "punct" && token.punct === ":") continue;
            throw new BasicError("SYNTAX", token.pos);

        }

        return statements;
    }

    private parseStatement(): Statement {
        const token = this.peek();

        if (token.kind === "remark") {
            this.pos += 1;
            return { kind: "remark", text: token.text };
        }

        /* No keyword: an assignment with LET left off -- unless it is
         * MID$(...)=, the one assignment whose target is a call. */
        if (token.kind === "name") {
            if (token.name === "MID" && token.sigil === "$") {
                return this.parseMidAssign();
            }
            return this.parseAssignment();
        }

        if (token.kind === "keyword") {
            this.pos += 1;
            switch (token.keyword) {
                case "LET":
                    return this.parseAssignment();
                case "PRINT":
                    return this.parsePrint();
                case "DIM":
                    return this.parseDim();
                case "END":
                    return { kind: "end" };
                case "RUN":
                    return { kind: "run" };
                case "NEW":
                    return { kind: "new" };
                case "CLEAR":
                    return { kind: "clear" };
                case "LIST":
                    return this.parseList();
                case "DELETE": {
                    const range = this.parseRange();
                    /* A bare DELETE would erase everything by accident. */
                    if (range.from === null && range.to === null) {
                        throw new BasicError("SYNTAX", token.pos);
                    }
                    return { kind: "delete", ...range };
                }
                case "RENUM": {
                    const [newStart, oldStart, increment] = this.parseOptionalNumbers(3);
                    return { kind: "renum", newStart, oldStart, increment };
                }
                case "AUTO": {
                    const [start, increment] = this.parseOptionalNumbers(2);
                    return { kind: "auto", start, increment };
                }
                case "EDIT":
                    return { kind: "edit", line: this.parseLineNumber() };
                case "CLS":
                    return { kind: "cls" };
                case "DELAY":
                    return { kind: "delay", milliseconds: this.parseExpression() };
                case "LOCATE": {
                    const [row, column] = this.parseOptionalExpressions(2);
                    return { kind: "locate", row, column };
                }
                case "COLOR": {
                    const [foreground, background] = this.parseOptionalExpressions(2);
                    return { kind: "color", foreground, background };
                }
                case "DEFINT":
                    return this.parseDefType("%");
                case "DEFSNG":
                    return this.parseDefType("!");
                case "DEFDBL":
                    return this.parseDefType("#");
                case "DEFSTR":
                    return this.parseDefType("$");
                case "GOTO":
                    return { kind: "goto", line: this.parseLineNumber() };
                case "GOSUB":
                    return { kind: "gosub", line: this.parseLineNumber() };
                case "RETURN":
                    return { kind: "return" };
                case "IF":
                    return this.parseIf();
                case "FOR":
                    return this.parseFor();
                case "NEXT":
                    return this.parseNext();
                case "ON":
                    return this.parseOn();
                case "STOP":
                    return { kind: "stop" };
                case "CONT":
                    return { kind: "cont" };
                case "WHILE":
                    return { kind: "while", condition: this.parseExpression() };
                case "WEND":
                    return { kind: "wend" };
                case "SWAP":
                    return this.parseSwap();
                case "TRON":
                    return { kind: "trace", on: true };
                case "TROFF":
                    return { kind: "trace", on: false };
                case "DEF":
                    return this.parseDefFn();
                case "RANDOMIZE":
                    return {
                        kind: "randomize",
                        seed: this.atStatementEnd() ? null : this.parseExpression(),
                    };
                case "INPUT":
                    return this.parseInput();
                case "LINE":
                    return this.parseLineInput();
                case "DATA":
                    return this.parseData();
                case "READ":
                    return { kind: "read", targets: this.parseTargets() };
                case "RESTORE":
                    return {
                        kind: "restore",
                        line:
                            this.peek().kind === "number"
                                ? this.parseLineNumber()
                                : null,
                    };
                default:
                    break;
            }
        }

        throw new BasicError("SYNTAX", token.pos);
    }

    /** `[LET] A = expr' or `[LET] A(1,2) = expr'. */
    private parseAssignment(): Statement {
        const target = this.parseLValue();
        if (this.takeOperator("=") === null) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }
        return { kind: "let", target, value: this.parseExpression() };
    }

    private parseLValue(): LValue {
        const token = this.peek();
        if (token.kind !== "name") throw new BasicError("SYNTAX", token.pos);
        this.pos += 1;

        const next = this.peek();
        if (next.kind === "punct" && next.punct === "(") {
            return {
                kind: "element",
                name: token.name,
                sigil: token.sigil,
                subscripts: this.parseArguments(),
            };
        }

        return { kind: "variable", name: token.name, sigil: token.sigil };
    }

    /**
     * `PRINT a, b; TAB(10); c;'
     *
     * A trailing separator suppresses the newline, which is how a
     * program builds one line of output from several PRINTs.
     */
    private parsePrint(): Statement {
        if (this.takeKeyword("USING")) return this.parsePrintUsing();

        const items: PrintItem[] = [];
        let newline = true;

        for (;;) {
            if (this.atStatementEnd()) break;

            if (this.takePunct(",")) {
                items.push({ kind: "zone" });
                newline = false;
                continue;
            }
            if (this.takePunct(";")) {
                items.push({ kind: "adjacent" });
                newline = false;
                continue;
            }

            const positional = this.tryParsePrintFunction();
            items.push(positional ?? {
                kind: "expression",
                expr: this.parseExpression(),
            });
            newline = true;
        }

        return { kind: "print", items, newline };
    }

    /** `PRINT USING fmt; a, b, c' -- separators only separate here. */
    private parsePrintUsing(): Statement {
        const format = this.parseExpression();
        if (!this.takePunct(";") && !this.takePunct(",")) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }

        const values: Expr[] = [];
        let newline = true;
        while (!this.atStatementEnd()) {
            values.push(this.parseExpression());
            newline = true;
            if (this.takePunct(";") || this.takePunct(",")) newline = false;
        }

        return { kind: "printUsing", format, values, newline };
    }

    /** `MID$(A$, start[, length]) = value'. */
    private parseMidAssign(): Statement {
        this.pos += 1; /* MID$ */
        this.expectPunct("(");

        const target = this.parseLValue();
        if (!this.takePunct(",")) throw new BasicError("SYNTAX", this.peek().pos);
        const start = this.parseExpression();
        const length = this.takePunct(",") ? this.parseExpression() : null;

        this.expectPunct(")");
        if (this.takeOperator("=") === null) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }

        return { kind: "midAssign", target, start, length, value: this.parseExpression() };
    }

    /**
     * TAB( and SPC( are not really functions -- they are only legal
     * here, and they move the cursor rather than producing a value --
     * so PRINT recognises them itself before falling back to an
     * ordinary expression.
     */
    private tryParsePrintFunction(): PrintItem | null {
        const token = this.peek();
        if (token.kind !== "name" || token.sigil !== "") return null;
        if (token.name !== "TAB" && token.name !== "SPC") return null;

        const next = this.tokens[this.pos + 1] as Token | undefined;
        if (!next || next.kind !== "punct" || next.punct !== "(") return null;

        this.pos += 1;
        const args = this.parseArguments();
        if (args.length !== 1) throw new BasicError("SYNTAX", token.pos);

        return { kind: token.name === "TAB" ? "tab" : "spc", expr: args[0] };
    }

    /** `DIM A(10), B$(5,5)'. */
    private parseDim(): Statement {
        const entries: DimEntry[] = [];

        do {
            const token = this.peek();
            if (token.kind !== "name") throw new BasicError("SYNTAX", token.pos);
            this.pos += 1;
            entries.push({
                name: token.name,
                sigil: token.sigil,
                bounds: this.parseArguments(),
            });
        } while (this.takePunct(","));

        return { kind: "dim", entries };
    }

    /** `LIST', `LIST 10', `LIST 10-20', `LIST -20', `LIST 10-'. */
    private parseList(): Statement {
        return { kind: "list", ...this.parseRange() };
    }

    /** The `10', `10-20', `-20', `10-' shape shared by LIST and DELETE. */
    private parseRange(): { from: number | null; to: number | null } {
        let from: number | null = null;
        let to: number | null = null;

        const first = this.peek();
        if (first.kind === "number") {
            this.pos += 1;
            from = first.value;
            to = first.value;
        }

        if (this.takeOperator("-") !== null) {
            to = null;
            const second = this.peek();
            if (second.kind === "number") {
                this.pos += 1;
                to = second.value;
            }
        }

        return { from, to };
    }

    /**
     * `a', `a,b', `a,,c', `,b' -- any of them may be left out, which is
     * how RENUM and AUTO take their arguments.
     */
    private parseOptionalNumbers(count: number): (number | null)[] {
        const values: (number | null)[] = [];

        for (let i = 0; i < count; i += 1) {
            if (i > 0 && !this.takePunct(",")) break;
            const token = this.peek();
            if (token.kind === "number") {
                this.pos += 1;
                values.push(token.value);
            } else {
                values.push(null);
            }
        }

        while (values.length < count) values.push(null);
        return values;
    }

    /**
     * `INPUT [prompt (; or ,)] var [, var ...]'
     *
     * A semicolon after the prompt keeps BASIC's own "? "; a comma
     * suppresses it. That is the whole difference, and it is the only
     * place the two punctuation marks disagree about anything.
     */
    private parseInput(): Statement {
        let prompt = "";
        let showQuestionMark = true;

        const token = this.peek();
        if (token.kind === "string") {
            this.pos += 1;
            prompt = token.value;
            if (this.takePunct(",")) showQuestionMark = false;
            else if (!this.takePunct(";")) {
                throw new BasicError("SYNTAX", this.peek().pos);
            }
        }

        return {
            kind: "input",
            prompt,
            showQuestionMark,
            targets: this.parseTargets(),
        };
    }

    /**
     * `LINE INPUT [prompt;] A$'
     *
     * Takes the line exactly as typed -- commas included, no "? " of its
     * own, no splitting. The way to read a name with a comma in it.
     */
    private parseLineInput(): Statement {
        if (!this.takeKeyword("INPUT")) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }

        let prompt = "";
        const token = this.peek();
        if (token.kind === "string") {
            this.pos += 1;
            prompt = token.value;
            this.takePunct(";");
        }

        return { kind: "lineInput", prompt, target: this.parseLValue() };
    }

    /** The tokenizer already split the items; collect them. */
    private parseData(): Statement {
        const items: DataItem[] = [];
        for (;;) {
            const token = this.peek();
            if (token.kind !== "data") break;
            this.pos += 1;
            items.push({ value: token.value, quoted: token.quoted });
        }
        return { kind: "data", items };
    }

    /**
     * `DEF FNA(X) = X*X', or `DEF FN A(X) = X*X'.
     *
     * Both spellings work: the tokenizer sees FN as a keyword when a
     * space follows and as the head of a name when one does not, so
     * this has to accept either shape.
     */
    private parseDefFn(): Statement {
        let name: string;
        let sigil: Sigil = "";

        if (this.takeKeyword("FN")) {
            const token = this.peek();
            if (token.kind !== "name") throw new BasicError("SYNTAX", token.pos);
            this.pos += 1;
            name = token.name;
            sigil = token.sigil;
        } else {
            const token = this.peek();
            if (token.kind !== "name") throw new BasicError("SYNTAX", token.pos);
            const split = userFunctionName(token.name);
            if (split === null) throw new BasicError("SYNTAX", token.pos);
            this.pos += 1;
            name = split;
            sigil = token.sigil;
        }

        this.expectPunct("(");
        const parameterToken = this.peek();
        if (parameterToken.kind !== "name") {
            throw new BasicError("SYNTAX", parameterToken.pos);
        }
        this.pos += 1;
        this.expectPunct(")");

        if (this.takeOperator("=") === null) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }

        return {
            kind: "defFn",
            definition: {
                name,
                sigil,
                parameter: {
                    name: parameterToken.name,
                    sigil: parameterToken.sigil,
                },
                body: this.parseExpression(),
            },
        };
    }

    /** `LOCATE 5,10', `LOCATE ,10', `COLOR 14' -- parts may be omitted. */
    private parseOptionalExpressions(count: number): (Expr | null)[] {
        const values: (Expr | null)[] = [];

        for (let i = 0; i < count; i += 1) {
            if (i > 0 && !this.takePunct(",")) break;
            const token = this.peek();
            const omitted =
                this.atStatementEnd() ||
                (token.kind === "punct" && token.punct === ",");
            values.push(omitted ? null : this.parseExpression());
        }

        while (values.length < count) values.push(null);
        return values;
    }

    /** `DEFINT A-Z' or `DEFINT A,C-E'. */
    private parseDefType(suffix: "%" | "!" | "#" | "$"): Statement {
        const ranges: LetterRange[] = [];

        do {
            const from = this.parseLetter();
            const to = this.takeOperator("-") !== null ? this.parseLetter() : from;
            ranges.push({ from, to });
        } while (this.takePunct(","));

        return { kind: "defType", suffix, ranges };
    }

    private parseLetter(): string {
        const token = this.peek();
        if (token.kind !== "name" || token.name.length !== 1 || token.sigil !== "") {
            throw new BasicError("SYNTAX", token.pos);
        }
        this.pos += 1;
        return token.name;
    }

    private parseTargets(): LValue[] {
        const targets: LValue[] = [this.parseLValue()];
        while (this.takePunct(",")) targets.push(this.parseLValue());
        return targets;
    }

    /**
     * A literal line number. Not an expression -- `GOTO A' is a syntax
     * error in BASIC, and computed jumps are what `ON…GOTO' is for.
     */
    private parseLineNumber(): number {
        const token = this.peek();
        if (token.kind !== "number" || !Number.isInteger(token.value)) {
            throw new BasicError("SYNTAX", token.pos);
        }
        this.pos += 1;
        return token.value;
    }

    /**
     * `IF cond THEN ...' / `IF cond GOTO n' / `IF cond THEN ... ELSE ...'
     *
     * Both branches run to the end of the line, so a colon inside them
     * does not end the IF: `IF X THEN A: B' runs both A and B, and only
     * when X is true. A bare number after THEN or ELSE means GOTO.
     */
    private parseIf(): Statement {
        const condition = this.parseExpression();

        let thenBranch: Statement[];
        if (this.takeKeyword("THEN")) {
            thenBranch = this.parseBranch();
        } else if (this.takeKeyword("GOTO")) {
            thenBranch = [{ kind: "goto", line: this.parseLineNumber() }];
        } else {
            throw new BasicError("SYNTAX", this.peek().pos);
        }

        const elseBranch = this.takeKeyword("ELSE") ? this.parseBranch() : null;

        return { kind: "if", condition, then: thenBranch, else: elseBranch };
    }

    /** One arm of an IF: a line number, or statements up to ELSE. */
    private parseBranch(): Statement[] {
        const token = this.peek();
        if (token.kind === "number") {
            return [{ kind: "goto", line: this.parseLineNumber() }];
        }

        const statements: Statement[] = [this.parseStatement()];
        while (this.peekPunct(":")) {
            this.pos += 1;
            if (this.atBranchEnd()) break;
            statements.push(this.parseStatement());
        }
        return statements;
    }

    private parseFor(): Statement {
        const variable = this.parseLoopVariable();
        if (this.takeOperator("=") === null) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }
        const from = this.parseExpression();

        if (!this.takeKeyword("TO")) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }
        const to = this.parseExpression();

        const step = this.takeKeyword("STEP") ? this.parseExpression() : null;

        return { kind: "for", variable, from, to, step };
    }

    /** `NEXT', `NEXT I' or `NEXT I,J' -- the last being NEXT I : NEXT J. */
    private parseNext(): Statement {
        const variables: LoopVariable[] = [];

        if (this.peek().kind === "name") {
            do {
                variables.push(this.parseLoopVariable());
            } while (this.takePunct(","));
        }

        return { kind: "next", variables };
    }

    private parseLoopVariable(): LoopVariable {
        const token = this.peek();
        if (token.kind !== "name") throw new BasicError("SYNTAX", token.pos);
        this.pos += 1;
        return { name: token.name, sigil: token.sigil };
    }

    /** `ON X GOTO 10,20,30' or `ON X GOSUB 10,20'. */
    private parseOn(): Statement {
        const selector = this.parseExpression();

        let target: "goto" | "gosub";
        if (this.takeKeyword("GOTO")) target = "goto";
        else if (this.takeKeyword("GOSUB")) target = "gosub";
        else throw new BasicError("SYNTAX", this.peek().pos);

        const lines: number[] = [this.parseLineNumber()];
        while (this.takePunct(",")) lines.push(this.parseLineNumber());

        return { kind: "on", selector, target, lines };
    }

    private parseSwap(): Statement {
        const left = this.parseLValue();
        if (!this.takePunct(",")) {
            throw new BasicError("SYNTAX", this.peek().pos);
        }
        return { kind: "swap", left, right: this.parseLValue() };
    }

    private takeKeyword(keyword: Keyword): boolean {
        const token = this.peek();
        if (token.kind !== "keyword" || token.keyword !== keyword) return false;
        this.pos += 1;
        return true;
    }

    private peekPunct(punct: Punct): boolean {
        const token = this.peek();
        return token.kind === "punct" && token.punct === punct;
    }

    private atBranchEnd(): boolean {
        const token = this.peek();
        if (token.kind === "end") return true;
        return token.kind === "keyword" && token.keyword === "ELSE";
    }

    private atStatementEnd(): boolean {
        const token = this.peek();
        if (token.kind === "end") return true;
        if (token.kind === "punct" && token.punct === ":") return true;
        /* ELSE closes whatever statement precedes it, or PRINT would
         * carry on and try to read it as another thing to print. */
        return token.kind === "keyword" && token.keyword === "ELSE";
    }
}

export function parseStatements(source: string): Statement[] {
    return new StatementParser(tokenize(source)).parseLine();
}
