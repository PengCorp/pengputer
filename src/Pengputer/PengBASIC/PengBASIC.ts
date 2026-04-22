/**
 * Author: Strawberry (enchantingstrawberry@discord)
 */
import _ from "lodash";
import { type Executable } from "@FileSystem/fileTypes";
import { type PC } from "../PC";
import { Token, TokenType } from "./types";

interface ScannerCtx {
    error: (line: number, message: string) => void;
}

class Scanner {
    private source: string;
    private tokens: Token[] = [];

    private start: number = 0;
    private current: number = 0;
    private line: number = 1;

    public constructor(source: string, ctx: ScannerCtx) {
        this.source = source;
    }

    public scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            scanToken();
        }

        this.tokens.push(new Token(TokenType.EOF, "", null, this.line));
        return this.tokens;
    }

    private isAtEnd(): boolean {
        return this.current < this.source.length;
    }
}

export class PengBASIC implements Executable {
    private pc: PC;

    private hadError: boolean;

    public constructor(pc: PC) {
        this.pc = pc;
        this.hadError = false;
    }

    public error(line: number, message: string) {
        this.report(line, "", message);
    }

    private report(line: number, where: string, message: string) {
        const { std } = this.pc;

        std.writeConsole(`[line "${line}"] Error ${where}: ${message}`);
        this.hadError = true;
    }

    private async runSource(source: string) {
        const { std } = this.pc;

        const scanner = new Scanner(source, this);
        std.writeConsole("Tokens\n");
    }

    private async runPrompt() {
        const { std } = this.pc;

        std.writeConsole("Welcome to PengBASIC!\n");

        while (true) {
            std.writeConsole("> ");
            const input = await std.readConsoleLine();

            if (input === null) {
                std.writeConsole("Goodbye!\n");
                break;
            }

            this.runSource(input);
            this.hadError = false;
        }
    }

    public async run(args: string[]) {
        await this.runPrompt();
    }
}
