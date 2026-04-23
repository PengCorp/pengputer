/**
 * Author: Strawberry (enchantingstrawberry@discord)
 */
import _ from "lodash";
import { type Executable } from "@FileSystem/fileTypes";
import { type PC } from "../PC";
import { Token, TokenType, type Literal } from "./types";

interface ScannerCtx {
    error: (line: number, message: string) => void;
}

class Scanner {
    private source: string = "";
    private tokens: Token[] = [];

    private start: number = 0;
    private current: number = 0;
    private line: number = 1;

    private ctx: ScannerCtx;

    public constructor(source: string, ctx: ScannerCtx) {
        this.setSource(source);
        this.ctx = ctx;
    }

    public setSource(source: string) {
        this.source = source;
        this.tokens = [];

        this.start = 0;
        this.current = 0;
        this.line = 1;
    }

    public scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }

        this.tokens.push(new Token(TokenType.EOF, "", null, this.line));
        return this.tokens;
    }

    private scanToken() {
        let c = this.advance();

        switch (c) {
            case "(":
                this.addToken(TokenType.LEFT_PAREN);
                break;
            case ")":
                this.addToken(TokenType.RIGHT_PAREN);
                break;
            case ",":
                this.addToken(TokenType.COMMA);
                break;
            case ".":
                this.addToken(TokenType.DOT);
                break;
            case ";":
                this.addToken(TokenType.SEMICOLON);
                break;
            case ":":
                this.addToken(TokenType.COLON);
                break;
            case "/":
                this.addToken(TokenType.SLASH);
                break;
            case "*":
                this.addToken(TokenType.STAR);
                break;
            case "+":
                this.addToken(TokenType.PLUS);
                break;
            case "-":
                this.addToken(TokenType.MINUS);
                break;
            case "=":
                this.addToken(TokenType.EQUAL);
                break;
            case "<":
                if (this.match(">")) {
                    this.addToken(TokenType.NOT_EQUAL);
                    break;
                }
                if (this.match("=")) {
                    this.addToken(TokenType.LESS_EQUAL);
                    break;
                }
                this.addToken(TokenType.LESS);
                break;
            case ">":
                if (this.match("=")) {
                    this.addToken(TokenType.GREATER_EQUAL);
                    break;
                }
                this.addToken(TokenType.GREATER);
                break;

            default:
                this.ctx.error(this.line, "Unexpected character.\n");
                break;
        }
    }

    private advance() {
        const char = this.source[this.current];
        this.current += 1;
        return char;
    }

    private addToken(type: TokenType, literal: Literal = null) {
        const text = this.source.slice(this.start, this.current);
        this.tokens.push(new Token(type, text, literal, this.line));
    }

    private isAtEnd(): boolean {
        return this.current >= this.source.length;
    }

    private match(expected: string): boolean {
        if (this.isAtEnd()) return false;
        if (this.source[this.current] != expected) return false;

        this.current += 1;
        return true;
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

        std.writeConsole(
            `line ${line}: Error${where ? ` ${where}` : ""}: ${message}`,
        );
        this.hadError = true;
    }

    private async runSource(source: string) {
        const { std } = this.pc;

        const scanner = new Scanner(source, this);
        std.writeConsole(JSON.stringify(scanner.scanTokens()));
        std.writeConsole("\n");
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
