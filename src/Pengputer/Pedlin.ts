import { Std } from "../Std";
import { clamp } from "@Toolbox/Math";
import { splitStringIntoCharacters } from "@Toolbox/String";
import { isNil } from "@Toolbox/typescript";
import { type Executable } from "@FileSystem/fileTypes";
import { type PC } from "./PC";
import _ from "lodash";

const SEPARATOR = ",";

// ========================================= Tokenizer ========================================

enum TokenType {
    LineNumber,
    Separator,
    Command,
    String,
}

type Token =
    | {
          type: TokenType.String;
          value: string;
      }
    | {
          type: TokenType.LineNumber;
          value: string;
      }
    | {
          type: TokenType.Separator;
      }
    | {
          type: TokenType.Command;
          value: string;
      };

const getStringFromToken = (token: Token) => {
    switch (token.type) {
        case TokenType.Command:
            return `command(${token.value})`;
        case TokenType.Separator:
            return `separator`;
        case TokenType.LineNumber:
            return `lineNumber(${token.value})`;
        case TokenType.String:
            return `string("${token.value}")`;
    }
    return "unknown";
};

const isNumeric = (char: string) => {
    return char >= "0" && char <= "9";
};

class CommandTokenizer {
    private input: string[];

    constructor(input: string) {
        this.input = splitStringIntoCharacters(input);
    }

    tokenize(): Token[] {
        const result: Token[] = [];

        while (this.getHasCharacters()) {
            this.skipWhitespace();

            if (!this.getHasCharacters()) {
                break;
            }

            const nextChar = this.peekCharacter();

            if (isNumeric(nextChar)) {
                const number = this.takeNumber();
                if (number === null) {
                    throw new Error("Invalid number.");
                }
                result.push({
                    type: TokenType.LineNumber,
                    value: number,
                });
                continue;
            } else if (nextChar === ".") {
                this.takeCurrentLine();
                result.push({
                    type: TokenType.LineNumber,
                    value: "current",
                });
            } else if (nextChar === SEPARATOR) {
                this.takeSeparator();
                result.push({
                    type: TokenType.Separator,
                });
            } else if (nextChar === '"') {
                const string = this.takeString();
                if (string === null) {
                    throw new Error("Invalid string.");
                }
                result.push({
                    type: TokenType.String,
                    value: string,
                });
            } else {
                const command = this.takeCommand();
                if (command === null) {
                    throw new Error("Invalid command.");
                }
                result.push({
                    type: TokenType.Command,
                    value: command,
                });
            }
        }

        return result;
    }

    private shiftCharacter() {
        return this.input.shift();
    }

    private peekCharacter() {
        return this.input[0];
    }

    private getHasCharacters() {
        return this.input.length > 0;
    }

    private skipWhitespace() {
        while (this.getHasCharacters() && this.peekCharacter() === " ") {
            this.input.shift();
        }
    }

    private takeNumber(): string | null {
        const result: string[] = [];

        while (this.getHasCharacters() && isNumeric(this.peekCharacter())) {
            result.push(this.shiftCharacter()!);
        }

        if (result.length === 0) {
            return null;
        }

        return result.join("");
    }

    private takeString(): string | null {
        const result: string[] = [];

        if (this.peekCharacter() !== '"') {
            return null;
        }

        this.shiftCharacter();

        while (this.getHasCharacters()) {
            const nextChar = this.peekCharacter();

            if (nextChar === "\\") {
                this.shiftCharacter();
                if (this.getHasCharacters()) {
                    result.push(this.shiftCharacter()!);
                }
                continue;
            }

            if (nextChar === '"') {
                this.shiftCharacter();
                break;
            }

            result.push(this.shiftCharacter()!);
        }

        return result.join("");
    }

    private takeCommand(): string | null {
        const nextChar = this.peekCharacter();
        if (
            (nextChar >= "a" && nextChar <= "z") ||
            (nextChar >= "A" && nextChar <= "Z") ||
            nextChar === "?"
        ) {
            return this.shiftCharacter()!;
        }
        return null;
    }

    private takeSeparator(): string | null {
        const nextChar = this.peekCharacter();
        if (nextChar === SEPARATOR) {
            return this.shiftCharacter()!;
        }
        return null;
    }

    private takeCurrentLine(): string | null {
        const nextChar = this.peekCharacter();
        if (nextChar === ".") {
            return this.shiftCharacter()!;
        }
        return null;
    }
}

// ========================================= End tokenizer =========================================

// ========================================= Command parser ========================================

enum CommandType {
    Help,
    Insert,
    List,
    EditLine,
    Page,
    NoOp,
    Delete,
    Quit,
    Search,
    Replace,
}

type CommandHelp = {
    type: CommandType.Help;
};

type CommandInsert = {
    type: CommandType.Insert;
    atLine: number;
};

type CommandList = {
    type: CommandType.List;
    fromLine: number;
    toLine: number;
};

type CommandEditLine = {
    type: CommandType.EditLine;
    atLine: number;
    shouldAdvanceLine: boolean;
};

type CommandPage = {
    type: CommandType.Page;
    fromLine: number;
    toLine: number;
    newCurrentLine: number;
};

type CommandNoop = { type: CommandType.NoOp };

type CommandDelete = {
    type: CommandType.Delete;
    fromLine: number;
    toLine: number;
};

type CommandQuit = { type: CommandType.Quit };

type CommandSearch = {
    type: CommandType.Search;
    fromLine: number;
    toLine: number;
    isQuery: boolean;
} & (
    | { reuseLastPattern: true }
    | { reuseLastPattern: false; searchText: string }
);

type CommandReplace = {
    type: CommandType.Replace;
    fromLine: number;
    toLine: number;
    isQuery: boolean;
} & (
    | { reuseLastPattern: true }
    | { reuseLastPattern: false; oldText: string; newText: string }
);

type Command =
    | CommandHelp
    | CommandInsert
    | CommandList
    | CommandEditLine
    | CommandPage
    | CommandNoop
    | CommandDelete
    | CommandQuit
    | CommandSearch
    | CommandReplace;

interface CommandParserContext {
    totalLines: number;
    currentLine: number;
    screenHeight: number;
}

class CommandParser {
    totalLines: number = 0;
    currentLine: number = 0;
    screenHeight: number = 0;

    constructor() {}

    private lineNumberToIndex(lineNumber: string) {
        if (lineNumber === "current") {
            return this.currentLine;
        }

        let result = Number(lineNumber) - 1;

        if (result !== Math.floor(result) || result < 0) {
            throw new Error("Invalid line number");
        }

        return result;
    }

    private getViewCenteredAround(lineNumber: number) {
        let windowHeight = this.screenHeight - 1;

        let pivot = (windowHeight - 1) / 2;

        let linesBefore = Math.floor(pivot);
        let linesAfter = Math.ceil(pivot);

        let fromLine = lineNumber - linesBefore;
        let toLine = lineNumber + linesAfter;

        let startOverflow = Math.max(0, 0 - fromLine);
        let endOverflow = Math.max(0, toLine - (this.totalLines - 1));

        fromLine -= endOverflow;
        toLine += startOverflow;

        fromLine = clamp(fromLine, 0, this.totalLines - 1);
        toLine = clamp(toLine, 0, this.totalLines - 1);

        return [fromLine, toLine];
    }

    private parseHelp(): CommandHelp {
        return { type: CommandType.Help };
    }

    private parseInsert(lineNumbers: (number | null)[]): CommandInsert {
        let atLine = 0;

        if (lineNumbers.length === 0) {
            atLine = this.currentLine;
        } else if (lineNumbers.length === 1) {
            atLine = clamp(
                lineNumbers[0] ?? this.currentLine,
                0,
                this.totalLines,
            );
        }

        if (lineNumbers.length > 1) {
            throw new Error("Too many arguments");
        }

        return {
            type: CommandType.Insert,
            atLine,
        };
    }

    private parseList(
        lineNumbers: (number | null)[],
    ): CommandList | CommandNoop {
        let windowHeight = this.screenHeight - 1;

        if (lineNumbers.length === 0) {
            const [from, to] = this.getViewCenteredAround(this.currentLine);
            return {
                type: CommandType.List,
                fromLine: from,
                toLine: to,
            };
        }

        let fromLine = lineNumbers[0];

        if (lineNumbers.length === 1) {
            if (isNil(fromLine)) {
                throw new Error("Entry error");
            }

            if (fromLine >= this.totalLines) {
                return {
                    type: CommandType.NoOp,
                };
            }

            const [from, to] = this.getViewCenteredAround(fromLine);
            return {
                type: CommandType.List,
                fromLine: from,
                toLine: to,
            };
        }

        let toLine = lineNumbers[1];

        if (lineNumbers.length === 2) {
            if (isNil(fromLine) && isNil(toLine)) {
                const [from, to] = this.getViewCenteredAround(this.currentLine);
                return {
                    type: CommandType.List,
                    fromLine: from,
                    toLine: to,
                };
            } else if (isNil(fromLine) && !isNil(toLine)) {
                return {
                    type: CommandType.List,
                    fromLine: 0,
                    toLine: clamp(toLine, 0, this.totalLines - 1),
                };
            } else if (!isNil(fromLine) && isNil(toLine)) {
                if (fromLine >= this.totalLines) {
                    return {
                        type: CommandType.NoOp,
                    };
                }

                return {
                    type: CommandType.List,
                    fromLine: fromLine,
                    toLine: clamp(
                        fromLine + windowHeight - 1,
                        0,
                        this.totalLines - 1,
                    ),
                };
            } else if (!isNil(fromLine) && !isNil(toLine)) {
                if (fromLine >= this.totalLines) {
                    return {
                        type: CommandType.NoOp,
                    };
                }

                if (toLine < fromLine) {
                    throw new Error("Entry error");
                }

                return {
                    type: CommandType.List,
                    fromLine: fromLine,
                    toLine: clamp(toLine, 0, this.totalLines - 1),
                };
            }
        }

        if (lineNumbers.length > 2) {
            throw new Error("Too many arguments");
        }

        throw new Error("Unreachable");
    }

    private parsePage(
        lineNumbers: (number | null)[],
    ): CommandPage | CommandNoop {
        let windowHeight = this.screenHeight - 1;

        if (lineNumbers.length === 0) {
            if (this.currentLine >= this.totalLines - 1) {
                return { type: CommandType.NoOp };
            }

            let fromLine = this.currentLine === 0 ? 0 : this.currentLine + 1;

            return {
                type: CommandType.Page,
                fromLine: clamp(fromLine, 0, this.totalLines - 1),
                toLine: clamp(
                    fromLine + (windowHeight - 1),
                    0,
                    this.totalLines - 1,
                ),
                newCurrentLine: clamp(
                    fromLine + (windowHeight - 1),
                    0,
                    this.totalLines - 1,
                ),
            };
        }

        let fromLine = lineNumbers[0];

        if (lineNumbers.length === 1) {
            if (isNil(fromLine)) {
                throw new Error("Entry error");
            }

            if (fromLine >= this.totalLines) {
                return { type: CommandType.NoOp };
            }

            return {
                type: CommandType.Page,
                fromLine: fromLine,
                toLine: clamp(
                    fromLine + (windowHeight - 1),
                    0,
                    this.totalLines - 1,
                ),
                newCurrentLine: clamp(
                    fromLine + (windowHeight - 1),
                    0,
                    this.totalLines - 1,
                ),
            };
        }

        if (lineNumbers.length > 1) {
            throw new Error("Entry error");
        }

        throw new Error("Unreachable");
    }

    private parseDelete(
        lineNumbers: (number | null)[],
    ): CommandDelete | CommandNoop {
        if (lineNumbers.length === 0) {
            return {
                type: CommandType.Delete,
                fromLine: this.currentLine,
                toLine: this.currentLine,
            };
        }

        let fromLine = lineNumbers[0];

        if (lineNumbers.length === 1) {
            if (isNil(fromLine)) {
                throw new Error("Entry error");
            }

            if (fromLine >= this.totalLines) {
                return { type: CommandType.NoOp };
            }

            return {
                type: CommandType.Delete,
                fromLine: clamp(fromLine, 0, this.totalLines - 1),
                toLine: clamp(fromLine, 0, this.totalLines - 1),
            };
        }

        let toLine = lineNumbers[1];

        if (lineNumbers.length === 2) {
            if (!isNil(fromLine) && fromLine >= this.totalLines) {
                return { type: CommandType.NoOp };
            }

            fromLine = clamp(fromLine ?? 0, 0, this.totalLines - 1);
            toLine = clamp(
                toLine ?? this.totalLines - 1,
                0,
                this.totalLines - 1,
            );

            if (toLine < fromLine) {
                throw new Error("Entry error");
            }

            return {
                type: CommandType.Delete,
                fromLine,
                toLine,
            };
        }

        if (lineNumbers.length > 2) {
            throw new Error("Entry error");
        }

        throw new Error("Unreachable");
    }

    /**
     * Default range for Search/Replace when no explicit line numbers are
     * given: starts right after the current line, wrapping around to the
     * start of the file if the current line is at or past the end.
     */
    private getDefaultSearchReplaceRange(): [number, number] {
        const from =
            this.currentLine + 1 < this.totalLines ? this.currentLine + 1 : 0;
        return [from, this.totalLines - 1];
    }

    private parseSearchReplaceRange(
        lineNumbers: (number | null)[],
    ): [number, number] {
        if (lineNumbers.length === 0) {
            return this.getDefaultSearchReplaceRange();
        }

        const fromLine = lineNumbers[0];

        if (lineNumbers.length === 1) {
            if (isNil(fromLine)) {
                throw new Error("Entry error");
            }
            return [
                clamp(fromLine, 0, this.totalLines - 1),
                this.totalLines - 1,
            ];
        }

        const toLine = lineNumbers[1];

        if (lineNumbers.length === 2) {
            const [defaultFrom, defaultTo] =
                this.getDefaultSearchReplaceRange();
            const from = clamp(
                fromLine ?? defaultFrom,
                0,
                this.totalLines - 1,
            );
            const to = clamp(toLine ?? defaultTo, 0, this.totalLines - 1);

            if (to < from) {
                throw new Error("Entry error");
            }

            return [from, to];
        }

        throw new Error("Too many arguments");
    }

    private parseSearch(
        tokens: Token[],
        lineNumbers: (number | null)[],
        isQuery: boolean,
    ): CommandSearch {
        const [fromLine, toLine] = this.parseSearchReplaceRange(lineNumbers);

        let searchText: string | null = null;
        const searchTextToken = tokens[0];
        if (searchTextToken?.type === TokenType.String) {
            tokens.shift();
            searchText = searchTextToken.value;
        }

        if (searchText === null) {
            return { type: CommandType.Search, fromLine, toLine, isQuery, reuseLastPattern: true };
        }

        return {
            type: CommandType.Search,
            fromLine,
            toLine,
            isQuery,
            reuseLastPattern: false,
            searchText,
        };
    }

    private parseReplace(
        tokens: Token[],
        lineNumbers: (number | null)[],
        isQuery: boolean,
    ): CommandReplace {
        const [fromLine, toLine] = this.parseSearchReplaceRange(lineNumbers);

        let oldText: string | null = null;
        let newText = "";
        const oldTextToken = tokens[0];
        if (oldTextToken?.type === TokenType.String) {
            tokens.shift();
            oldText = oldTextToken.value;

            const newTextToken = tokens[0];
            if (newTextToken?.type === TokenType.String) {
                tokens.shift();
                newText = newTextToken.value;
            }
        }

        if (oldText === null) {
            return { type: CommandType.Replace, fromLine, toLine, isQuery, reuseLastPattern: true };
        }

        return {
            type: CommandType.Replace,
            fromLine,
            toLine,
            isQuery,
            reuseLastPattern: false,
            oldText,
            newText,
        };
    }

    /** Returns next command or throws. Modifies the passed in tokens array. */
    getNextCommand(tokens: Token[]): Command {
        const lineNumbers: (number | null)[] = [];

        let numberAdded = false;
        let lastIsSeparator = false;
        while (tokens.length > 0) {
            const nextToken = tokens[0];
            if (nextToken.type === TokenType.LineNumber) {
                let value = this.lineNumberToIndex(nextToken.value);
                lastIsSeparator = false;
                lineNumbers.push(value);
                numberAdded = true;
                tokens.shift();
                continue;
            } else if (nextToken.type === TokenType.Separator) {
                lastIsSeparator = true;
                if (!numberAdded) {
                    lineNumbers.push(null);
                }
                numberAdded = false;
                tokens.shift();
                continue;
            }
            break;
        }
        if (lastIsSeparator) {
            lineNumbers.push(null);
        }

        // A leading "?" is a query-mode modifier when it prefixes Search or
        // Replace (e.g. "?S", "?R"); otherwise it's the standalone Help command.
        let isQuery = false;
        if (
            tokens[0]?.type === TokenType.Command &&
            tokens[0].value === "?" &&
            tokens[1]?.type === TokenType.Command &&
            (tokens[1].value.toLowerCase() === "s" ||
                tokens[1].value.toLowerCase() === "r")
        ) {
            isQuery = true;
            tokens.shift();
        }

        const commandToken = tokens[0];

        if (!commandToken) {
            if (lineNumbers.length > 1) {
                throw new Error("Entry error.");
            }

            let at = lineNumbers[0] ?? this.currentLine;

            return {
                type: CommandType.EditLine,
                atLine: clamp(at, 0, this.totalLines),
                shouldAdvanceLine: isNil(lineNumbers[0]),
            };
        }
        if (commandToken.type !== TokenType.Command) {
            throw new Error(
                `Unexpected token: ${getStringFromToken(tokens[0])}`,
            );
        }
        tokens.shift();
        const command = commandToken.value.toLowerCase();

        switch (command) {
            case "?": {
                return this.parseHelp();
            }
            case "i": {
                return this.parseInsert(lineNumbers);
            }
            case "l": {
                return this.parseList(lineNumbers);
            }
            case "p": {
                return this.parsePage(lineNumbers);
            }
            case "d": {
                return this.parseDelete(lineNumbers);
            }
            case "q": {
                return { type: CommandType.Quit };
            }
            case "s": {
                return this.parseSearch(tokens, lineNumbers, isQuery);
            }
            case "r": {
                return this.parseReplace(tokens, lineNumbers, isQuery);
            }
        }

        throw new Error(`Unknown command: ${command}`);
    }

    updateContext({
        totalLines,
        currentLine,
        screenHeight,
    }: CommandParserContext) {
        this.totalLines = totalLines;
        this.currentLine = currentLine;
        this.screenHeight = screenHeight;
    }
}

// ========================================= End command parser ========================================

export class Pedlin implements Executable {
    private pc: PC;
    private std: Std;

    private lines: string[];
    private currentLine: number;

    private lastSearchText: string | null = null;
    private lastReplaceOld: string | null = null;
    private lastReplaceNew: string = "";

    constructor(pc: PC) {
        this.pc = pc;
        this.std = pc.std;

        this.lines = [];
        this.currentLine = 0;
    }

    async run(args: string[]) {
        const { std } = this;

        this.pc.std.writeConsole("New file\n");
        while (true) {
            try {
                const shouldQuit = await this.readCommand();
                if (shouldQuit) {
                    break;
                }
            } catch (e: any) {
                std.writeConsole(e.message);
                std.writeConsole("\n");
            }
        }
    }

    private printLineNumber(number: number) {
        const { std } = this;

        let indicator = " ";
        if (number === this.currentLine) {
            indicator = "*";
        }
        std.writeConsole(`${_.padStart(String(number + 1), 8)}:${indicator}`);
    }

    private async insert() {
        const { std } = this;

        if (this.currentLine < this.lines.length) {
            this.printLineNumber(this.currentLine);
            std.writeConsole(`${this.lines[this.currentLine] ?? ""}\n`);
        }

        while (true) {
            this.printLineNumber(this.currentLine);
            const newLine = await std.readConsoleLine();
            if (newLine === null) {
                std.writeConsole("\n\n");
                break;
            }
            this.lines.splice(this.currentLine, 0, newLine);
            this.currentLine += 1;
        }
    }

    /** List lines at indexes, inclusive. */
    private async list(start: number, end: number) {
        const { std } = this;

        if (start < 0 || start > end) {
            throw new Error("Invalid range provided.");
        }

        for (let i = start; i <= this.lines.length - 1 && i <= end; i += 1) {
            this.printLineNumber(i);

            std.writeConsole(this.lines[i]);
            std.writeConsole("\n");
        }
    }

    private async editLine(atLine: number, shouldAdvanceLine: boolean) {
        const { std } = this;

        this.currentLine = atLine;

        if (shouldAdvanceLine) {
            this.currentLine = Math.min(
                this.lines.length,
                this.currentLine + 1,
            );
        }

        if (this.currentLine === this.lines.length) {
            return;
        }

        this.printLineNumber(this.currentLine);
        std.writeConsole(`${this.lines[this.currentLine] ?? ""}\n`);

        this.printLineNumber(this.currentLine);
        const newLine = await std.readConsoleLine();
        if (newLine === null) {
            std.writeConsole("\n\n");
        } else {
            if (newLine.length > 0) {
                this.lines[this.currentLine] = newLine;
            }
        }
    }

    /** List lines and move current line to end of range. */
    private page(fromLine: number, toLine: number) {
        const { std } = this;

        for (
            let i = fromLine;
            i <= this.lines.length - 1 && i <= toLine;
            i += 1
        ) {
            this.printLineNumber(i);

            std.writeConsole(this.lines[i]);
            std.writeConsole("\n");
        }
    }

    private deleteLines(fromLine: number, toLine: number) {
        this.lines.splice(fromLine, toLine - fromLine + 1);
    }

    /** Reads a single confirmation keypress for query-mode Search/Replace. */
    private async readConfirmKey(): Promise<"accept" | "reject" | "abort"> {
        const { std } = this;

        std.flushKeyboardEvents();
        while (true) {
            const ev = await std.waitForNextKeyboardEvent();
            if (!ev.pressed) {
                continue;
            }

            if (ev.isControlDown && ev.code === "KeyC") {
                std.writeConsole("^C\n");
                return "abort";
            }
            if (ev.char === "\n") {
                std.writeConsole("\n");
                return "accept";
            }
            if (ev.char === "y" || ev.char === "Y") {
                std.writeConsole(`${ev.char}\n`);
                return "accept";
            }
            if (ev.char === "n" || ev.char === "N") {
                std.writeConsole(`${ev.char}\n`);
                return "reject";
            }
        }
    }

    /** Finds the first line containing searchText within the range, inclusive. */
    private async search(
        fromLine: number,
        toLine: number,
        searchText: string,
        isQuery: boolean,
    ) {
        const { std } = this;

        for (
            let i = fromLine;
            i <= toLine && i <= this.lines.length - 1;
            i += 1
        ) {
            const line = this.lines[i] ?? "";
            if (!line.includes(searchText)) {
                continue;
            }

            if (!isQuery) {
                this.currentLine = i;
                this.printLineNumber(i);
                std.writeConsole(`${line}\n`);
                return;
            }

            this.printLineNumber(i);
            std.writeConsole(`${line}\n`);
            std.writeConsole("O.K.? ");
            const result = await this.readConfirmKey();
            if (result === "abort") {
                return;
            }
            if (result === "accept") {
                this.currentLine = i;
                return;
            }
        }

        std.writeConsole("Not found\n");
    }

    /**
     * Replaces every occurrence of oldText on every line within the range,
     * inclusive, printing the line again after each individual substitution.
     * In query mode, each occurrence is previewed and must be confirmed
     * individually; declining a match leaves it untouched and scanning
     * resumes just past it, still within the same line.
     */
    private async replace(
        fromLine: number,
        toLine: number,
        oldText: string,
        newText: string,
        isQuery: boolean,
    ) {
        const { std } = this;
        let foundAny = false;

        for (
            let i = fromLine;
            i <= toLine && i <= this.lines.length - 1;
            i += 1
        ) {
            let searchFrom = 0;

            while (true) {
                const line = this.lines[i] ?? "";
                const matchIndex = line.indexOf(oldText, searchFrom);
                if (matchIndex === -1) {
                    break;
                }
                foundAny = true;

                const replacedLine =
                    line.slice(0, matchIndex) +
                    newText +
                    line.slice(matchIndex + oldText.length);

                if (!isQuery) {
                    this.lines[i] = replacedLine;
                    this.currentLine = i;
                    this.printLineNumber(i);
                    std.writeConsole(`${replacedLine}\n`);
                    searchFrom = matchIndex + newText.length;
                    continue;
                }

                this.printLineNumber(i);
                std.writeConsole(`${replacedLine}\n`);
                std.writeConsole("O.K.? ");
                const result = await this.readConfirmKey();
                if (result === "abort") {
                    return;
                }
                if (result === "accept") {
                    this.lines[i] = replacedLine;
                    this.currentLine = i;
                    searchFrom = matchIndex + newText.length;
                } else {
                    searchFrom = matchIndex + oldText.length;
                }
            }
        }

        if (!foundAny) {
            std.writeConsole("Not found\n");
        }
    }

    private writeHelp() {
        const { std } = this;

        const entries = [
            ["Edit line", "line#"],
            ["Append", "[#lines]A"],
            ["Copy", "[startline],[endline],toline[,times]C"],
            ["Delete", "[startline][,endline]D"],
            ["End (save file)", "E"],
            ["Insert", "[line]I"],
            ["List", "[startline][,endline]L"],
            ["Move", "[startline],[endline],tolineM"],
            ["Page", "[startline][,endline]P"],
            ["Quit (throw away changes)", "Q"],
            ["Replace", '[startline][,endline][?]R["oldtext"]["newtext"]'],
            ["Search", '[startline][,endline][?]S"text"'],
            ["Write", "[#lines]W"],
        ];

        const maxNameLength = entries.reduce(
            (acc, e) => (acc = Math.max(acc, e[0].length)),
            0,
        );

        for (const entry of entries) {
            std.writeConsole(_.padEnd(entry[0], maxNameLength));
            std.writeConsole("   ");
            std.writeConsole(entry[1]);
            std.writeConsole("\n");
        }
    }

    /** Returns true if a quit command was processed. */
    async readCommand(): Promise<boolean> {
        const { std } = this;

        std.writeConsole("*");
        const input = await std.readConsoleLine();
        if (isNil(input)) {
            return false;
        }

        const t = new CommandTokenizer(input ?? "");
        const tokens = t.tokenize();

        const p = new CommandParser();
        while (true) {
            p.updateContext({
                totalLines: this.lines.length,
                currentLine: this.currentLine,
                screenHeight: std.getConsoleSize().h,
            });
            const command = p.getNextCommand(tokens);

            switch (command.type) {
                case CommandType.List:
                    this.list(command.fromLine, command.toLine);
                    break;
                case CommandType.Insert:
                    this.currentLine = command.atLine;
                    await this.insert();
                    break;
                case CommandType.Help:
                    this.writeHelp();
                    break;
                case CommandType.EditLine:
                    await this.editLine(
                        command.atLine,
                        command.shouldAdvanceLine,
                    );
                    break;
                case CommandType.Page:
                    this.currentLine = command.newCurrentLine;
                    this.page(command.fromLine, command.toLine);
                    break;
                case CommandType.Delete:
                    this.currentLine = command.fromLine;
                    this.deleteLines(command.fromLine, command.toLine);
                    break;
                case CommandType.Search: {
                    let searchText: string;
                    if (command.reuseLastPattern) {
                        if (this.lastSearchText === null) {
                            throw new Error("Entry error");
                        }
                        searchText = this.lastSearchText;
                    } else {
                        searchText = command.searchText;
                        this.lastSearchText = searchText;
                    }
                    await this.search(
                        command.fromLine,
                        command.toLine,
                        searchText,
                        command.isQuery,
                    );
                    break;
                }
                case CommandType.Replace: {
                    let oldText: string;
                    let newText: string;
                    if (command.reuseLastPattern) {
                        if (this.lastReplaceOld === null) {
                            throw new Error("Entry error");
                        }
                        oldText = this.lastReplaceOld;
                        newText = this.lastReplaceNew;
                    } else {
                        oldText = command.oldText;
                        newText = command.newText;
                        this.lastReplaceOld = oldText;
                        this.lastReplaceNew = newText;
                    }
                    await this.replace(
                        command.fromLine,
                        command.toLine,
                        oldText,
                        newText,
                        command.isQuery,
                    );
                    break;
                }
                case CommandType.Quit:
                    return true;
            }

            if (tokens.length === 0) {
                break;
            }
        }

        return false;
    }
}
