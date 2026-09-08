import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole } from "./console";

function machine() {
    const console = new TestConsole();
    return { console, interpreter: new Interpreter(console) };
}

async function feed(interpreter: Interpreter, ...lines: string[]) {
    for (const line of lines) await interpreter.executeLine(line);
}

describe("DOWNLOAD", () => {
    it("saves what LIST would show", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "20 PRINT 2", "10 PRINT 1", "DOWNLOAD");
        expect(console.getDownloads()).toEqual([
            { filename: "PROGRAM.BAS", contents: "10 PRINT 1\n20 PRINT 2\n" },
        ]);
    });

    /**
     * Without it the last line of the file arrives at the prompt
     * unentered when the file is pasted or uploaded back -- the same
     * rule the listings in examples/ follow.
     */
    it("ends with a newline", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 PRINT 1", "DOWNLOAD");
        expect(console.getDownloads()[0].contents.endsWith("\n")).toBe(true);
    });

    it("keeps the typist's spacing", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10   PRINT    1", "DOWNLOAD");
        expect(console.getDownloads()[0].contents).toBe("10   PRINT    1\n");
    });

    it("takes a name", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 PRINT 1", 'DOWNLOAD "GAME.BAS"');
        expect(console.getDownloads()[0].filename).toBe("GAME.BAS");
    });

    it("saves an empty file for an empty program", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "DOWNLOAD");
        expect(console.getDownloads()[0].contents).toBe("");
    });
});

describe("UPLOAD", () => {
    it("loads a program", async () => {
        const { console, interpreter } = machine();
        console.provideUpload("10 PRINT 1\n20 PRINT 2\n");
        await feed(interpreter, "UPLOAD", "RUN");
        expect(console.getText()).toBe(" 1 \n 2 \n");
    });

    it("clears what was there first", async () => {
        const { console, interpreter } = machine();
        console.provideUpload("10 PRINT 99\n");
        await feed(interpreter, "10 PRINT 1", "20 PRINT 2", "UPLOAD", "LIST");
        expect(console.getText()).toBe("10 PRINT 99\n");
    });

    it("forgets variables and functions too", async () => {
        const { console, interpreter } = machine();
        console.provideUpload("10 PRINT A\n");
        await feed(interpreter, "A=7", "UPLOAD", "RUN");
        expect(console.getText()).toBe(" 0 \n");
    });

    it("does nothing when the picker is dismissed", async () => {
        const { console, interpreter } = machine();
        /* Nothing queued, which TestConsole answers as a cancellation. */
        await feed(interpreter, "10 PRINT 1", "UPLOAD", "LIST");
        expect(console.getText()).toBe("10 PRINT 1\n");
    });

    it("behaves exactly as pasting would", async () => {
        const { console, interpreter } = machine();
        console.provideUpload('10 REM HI\n20 PRINT "X"\n');
        await feed(interpreter, "UPLOAD", "LIST");
        expect(console.getText()).toBe('10 REM HI\n20 PRINT "X"\n');
    });

    it("copes with a file that has no trailing newline", async () => {
        const { console, interpreter } = machine();
        console.provideUpload("10 PRINT 1");
        await feed(interpreter, "UPLOAD", "RUN");
        expect(console.getText()).toBe(" 1 \n");
    });

    it("survives a round trip", async () => {
        const first = machine();
        await feed(
            first.interpreter,
            "10 FOR I=1 TO 3",
            "20 PRINT I;",
            "30 NEXT I",
            "DOWNLOAD",
        );

        const second = machine();
        second.console.provideUpload(first.console.getDownloads()[0].contents);
        await feed(second.interpreter, "UPLOAD", "RUN");
        expect(second.console.getText()).toBe(" 1  2  3 ");
    });
});
