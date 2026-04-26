export enum TokenType {
    // symbols
    LEFT_PAREN,
    RIGHT_PAREN,
    COMMA,
    DOT,
    SEMICOLON,
    COLON,
    SLASH,
    STAR,

    // operators
    PLUS,
    MINUS,
    EQUAL,
    NOT_EQUAL,
    GREATER,
    GREATER_EQUAL,
    LESS,
    LESS_EQUAL,
    AND,
    OR,
    NOT,
    XOR,
    MOD,

    // literals
    INTEGER,
    FLOAT,
    STRING,
    IDENTIFIER,

    // keywords
    IF,
    THEN,
    DO,
    WHILE,
    WEND,
    FOR,
    TO,
    NEXT,
    LET,
    DIM,
    END,
    GOSUB,
    GOTO,
    RETURN,
    REM,

    // interactive functions
    LIST,
    RENUM,
    RUN,

    EOF,
}

export type Literal = number | string | null;

export class Token {
    public type: TokenType;
    public lexeme: string;
    public literal: Literal;
    public line: number;

    public constructor(
        type: TokenType,
        lexeme: string,
        literal: Literal,
        line: number,
    ) {
        this.type = type;
        this.lexeme = lexeme;
        this.literal = literal;
        this.line = line;
    }

    public toString() {
        return `${this.type} ${this.lexeme} ${this.literal}`;
    }
}
