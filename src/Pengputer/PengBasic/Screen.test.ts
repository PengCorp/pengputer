import { describe, expect, it } from "vitest";
import { Interpreter } from "./Interpreter";
import { TestConsole, cgaColor } from "./console";
import { classicColors } from "@Color/ansi";

/* Indices rather than names, because these assertions compare colour
 * *identity*, not appearance. The classic palette pads its unfilled
 * tertiary slots with black, and the name "black" ends up pointing at
 * the last of them -- which paints black, but is not index 0. */
const BLACK = classicColors[0];
const RED = classicColors[1];
const GREEN = classicColors[2];
const YELLOW = classicColors[3];
const BLUE = classicColors[4];
const LIGHT_YELLOW = classicColors[11];

function machine(width = 80) {
    const console = new TestConsole(width);
    return { console, interpreter: new Interpreter(console) };
}

async function feed(interpreter: Interpreter, ...lines: string[]) {
    for (const line of lines) await interpreter.executeLine(line);
}

describe("CLS", () => {
    it("empties the screen and goes home", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 PRINT "GONE"',
            "20 CLS",
            '30 PRINT "HERE"',
            "RUN",
        );
        expect(console.getScreen()).toEqual(["HERE"]);
        expect(console.getCursor()).toEqual({ x: 0, y: 1 });
    });
});

describe("LOCATE", () => {
    it("puts text where it is told, counting from one", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 LOCATE 3,5:PRINT "X"', "RUN");
        expect(console.getRow(2)).toBe("    X");
    });

    it("moves only the row when the column is left out", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 PRINT "ABC";',
            '20 LOCATE 4:PRINT "Y"',
            "RUN",
        );
        expect(console.getRow(3)).toBe("   Y");
    });

    it("moves only the column when the row is left out", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 LOCATE ,10:PRINT "Z"', "RUN");
        expect(console.getRow(0)).toBe("         Z");
    });

    it("refuses a position off the top or left", async () => {
        const { interpreter } = machine();
        await expect(interpreter.executeLine("LOCATE 0,1")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });

    it("is what CSRLIN and POS report", async () => {
        /* Read before printing: both report where the cursor is *now*,
         * so asking mid-PRINT would see the column already advanced. */
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 LOCATE 7,3",
            "20 R=CSRLIN:C=POS(0)",
            "30 PRINT R;C",
            "RUN",
        );
        expect(console.getRow(6)).toBe("   7  3");
    });
});

describe("COLOR", () => {
    it("paints what is printed after it", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 COLOR 14,4:PRINT "!"', "RUN");
        const cell = console.getCellColors(0, 0);
        expect(cell?.fg).toEqual(LIGHT_YELLOW);
        expect(cell?.bg).toEqual(RED);
    });

    it("changes only the foreground when given one number", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 COLOR 2:PRINT "G"', "RUN");
        expect(console.getCellColors(0, 0)?.fg).toEqual(GREEN);
        expect(console.getCellColors(0, 0)?.bg).toEqual(BLACK);
    });

    it("refuses a colour that does not exist", async () => {
        const { interpreter } = machine();
        await expect(interpreter.executeLine("COLOR 32")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
        await expect(interpreter.executeLine("COLOR 1,16")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });

    /**
     * CGA kept blink in the top bit of the foreground, so sixteen
     * colours and a flag arrive as one number: 30 is blinking yellow.
     */
    it("blinks for a foreground of 16 or more", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 COLOR 30:PRINT "!"', "RUN");
        const cell = console.getCellColors(0, 0);
        expect(cell?.blink).toBe(true);
        expect(cell?.fg).toEqual(LIGHT_YELLOW);
    });

    it("does not blink below 16", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 COLOR 14:PRINT "!"', "RUN");
        expect(console.getCellColors(0, 0)?.blink).toBe(false);
    });

    it("leaves blink alone when only the background is given", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 COLOR 30:COLOR ,4:PRINT "!"', "RUN");
        expect(console.getCellColors(0, 0)?.blink).toBe(true);
    });

    /**
     * BASIC numbers colours the way IBM did, which is not the order the
     * machine's palette is in: 1 is blue and 4 is red, and the palette
     * has those swapped.
     */
    it("uses IBM's numbering, not the palette's", () => {
        expect(cgaColor(1)).toEqual(BLUE);
        expect(cgaColor(4)).toEqual(RED);
        expect(cgaColor(6)).toEqual(YELLOW);
        expect(cgaColor(14)).toEqual(LIGHT_YELLOW);
    });
});

describe("LOCATE's third argument", () => {
    it("hides and shows the cursor", async () => {
        const { console, interpreter } = machine();
        expect(console.getIsCursorVisible()).toBe(true);

        await feed(interpreter, "10 LOCATE ,,0", "RUN");
        expect(console.getIsCursorVisible()).toBe(false);

        await feed(interpreter, "10 LOCATE ,,1", "RUN");
        expect(console.getIsCursorVisible()).toBe(true);
    });

    it("moves and hides at once", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 LOCATE 3,5,0:PRINT "X"', "RUN");
        expect(console.getRow(2)).toBe("    X");
        expect(console.getIsCursorVisible()).toBe(false);
    });

    it("refuses anything but 0 or 1", async () => {
        const { interpreter } = machine();
        await expect(interpreter.executeLine("LOCATE ,,2")).rejects.toThrow(
            /ILLEGAL QUANTITY/,
        );
    });
});

describe("SCREEN()", () => {
    it("reads back a character that was printed", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 LOCATE 2,3:PRINT "Q";',
            "20 LOCATE 5,1",
            "30 PRINT SCREEN(2,3)",
            "RUN",
        );
        expect(console.getText()).toContain(" 81 ");
    });

    it("reads a space where nothing was written", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 PRINT SCREEN(10,10)", "RUN");
        expect(console.getText()).toBe(" 32 \n");
    });

    it("counts from one, like LOCATE", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 LOCATE 1,1:PRINT "A";',
            "20 LOCATE 3,1:PRINT SCREEN(1,1)",
            "RUN",
        );
        expect(console.getRow(2)).toBe(" 65");
    });

    it("lets a program find what it is about to hit", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 LOCATE 5,10:PRINT "#";',
            "20 LOCATE 20,1",
            '30 IF SCREEN(5,10)=35 THEN PRINT "WALL" ELSE PRINT "CLEAR"',
            "RUN",
        );
        expect(console.getRow(19)).toBe("WALL");
    });

    it("refuses a cell off the screen", async () => {
        const { interpreter } = machine();
        await expect(
            interpreter.executeLine("PRINT SCREEN(0,1)"),
        ).rejects.toThrow(/ILLEGAL QUANTITY/);
    });
});

describe("INKEY$", () => {
    it("is empty when nothing was pressed", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 PRINT "["+INKEY$+"]"', "RUN");
        expect(console.getText()).toBe("[]\n");
    });

    it("hands over one key at a time", async () => {
        const { console, interpreter } = machine();
        console.provideKeys("A", "B");
        await feed(interpreter, '10 PRINT INKEY$;INKEY$;INKEY$;"."', "RUN");
        expect(console.getText()).toBe("AB.\n");
    });

    it("does not wait, so a poll loop can run", async () => {
        const { console, interpreter } = machine();
        console.provideKeys("Q");
        await feed(
            interpreter,
            "10 FOR I=1 TO 50",
            "20 K$=INKEY$",
            '30 IF K$<>"" THEN PRINT "GOT ";K$: I=50',
            "40 NEXT I",
            "RUN",
        );
        expect(console.getText()).toBe("GOT Q\n");
    });
});

describe("DELAY", () => {
    it("waits for the time asked", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 DELAY 250", "RUN");
        expect(console.getWaitedMilliseconds()).toBe(250);
    });

    it("waits each time round a loop", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 FOR I=1 TO 4",
            "20 DELAY 10",
            "30 NEXT",
            "RUN",
        );
        expect(console.getWaitedMilliseconds()).toBe(40);
    });

    it("takes an expression", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 N=3", "20 DELAY N*100", "RUN");
        expect(console.getWaitedMilliseconds()).toBe(300);
    });

    it("treats a negative delay as none", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "10 DELAY -5", "RUN");
        expect(console.getWaitedMilliseconds()).toBe(0);
    });

    it("can still be interrupted part way through", async () => {
        const { console, interpreter } = machine();
        console.setBreak(true);
        await feed(
            interpreter,
            "10 DELAY 10000",
            '20 PRINT "NOT REACHED"',
            "RUN",
        );
        expect(console.getText()).toBe("Break in 10\n");
        /* Stopped after the first slice, not the whole ten seconds. */
        expect(console.getWaitedMilliseconds()).toBeLessThan(100);
    });
});

describe("the clock", () => {
    const fixed = () => new Date(1985, 10, 11, 14, 30, 45, 500);

    function clocked() {
        const console = new TestConsole();
        return {
            console,
            interpreter: new Interpreter(console, undefined, fixed),
        };
    }

    it("TIME$ and DATE$", async () => {
        const { console, interpreter } = clocked();
        await feed(interpreter, '10 PRINT TIME$;" ";DATE$', "RUN");
        expect(console.getText()).toBe("14:30:45 11-11-1985\n");
    });

    it("TIMER counts seconds since midnight", async () => {
        const { console, interpreter } = clocked();
        await feed(interpreter, "10 PRINT TIMER", "RUN");
        expect(console.getText()).toBe(" 52245.5 \n");
    });

    it("may be written without parentheses", async () => {
        const { console, interpreter } = clocked();
        await feed(interpreter, "10 PRINT INT(TIMER)", "RUN");
        expect(console.getText()).toBe(" 52245 \n");
    });
});

describe("DEFINT and friends", () => {
    it("makes unsuffixed names in the range integers", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 DEFINT A-Z",
            "20 X=2.7",
            "30 PRINT X",
            "RUN",
        );
        expect(console.getText()).toBe(" 3 \n");
    });

    it("leaves letters outside the range alone", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 DEFINT A-C",
            "20 A=2.7:Z=2.7",
            "30 PRINT A;Z",
            "RUN",
        );
        expect(console.getText()).toBe(" 3  2.7 \n");
    });

    it("is overridden by an explicit sigil", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 DEFINT A-Z",
            "20 X!=2.7",
            "30 PRINT X!",
            "RUN",
        );
        expect(console.getText()).toBe(" 2.7 \n");
    });

    it("DEFSTR makes them strings", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 DEFSTR S",
            '20 S="HI"',
            "30 PRINT S",
            "RUN",
        );
        expect(console.getText()).toBe("HI\n");
    });

    it("takes a list of ranges", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            "10 DEFINT A,C-D",
            "20 A=1.6:B=1.6:C=1.6",
            "30 PRINT A;B;C",
            "RUN",
        );
        expect(console.getText()).toBe(" 2  1.6  2 \n");
    });

    it("applies to INPUT and READ targets too", async () => {
        const { console, interpreter } = machine();
        console.provideInput("2.7");
        await feed(
            interpreter,
            "10 DEFINT A-Z",
            "20 INPUT X",
            "30 PRINT X",
            "RUN",
        );
        expect(console.getText()).toBe("? 2.7\n 3 \n");
    });

    it("is forgotten by RUN", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, "DEFINT A-Z", "10 X=2.7", "20 PRINT X", "RUN");
        expect(console.getText()).toBe(" 2.7 \n");
    });
});

describe("carriage return", () => {
    it("goes back to the start of the line without moving down", async () => {
        const { console, interpreter } = machine();
        await feed(interpreter, '10 PRINT "ABC";CHR$(13);"X"', "RUN");
        expect(console.getRow(0)).toBe("XBC");
    });

    it("is how a program overwrites what it just printed", async () => {
        const { console, interpreter } = machine();
        await feed(
            interpreter,
            '10 PRINT "WORKING";',
            '20 PRINT CHR$(13);"DONE   "',
            "RUN",
        );
        expect(console.getRow(0)).toBe("DONE");
    });
});
