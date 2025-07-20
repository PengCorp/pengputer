import { classicColors } from "../Color/ansi";
import { Std } from "../Std";
import { State, StateManager } from "../Toolbox/StateManager";
import { Vector } from "../Toolbox/Vector";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

enum GameStateKey {
  Paint,
  Menu,
}

const printStatusLine = (std: Std, string: string) => {
  std.resetConsoleAttributes();
  std.setConsoleCursorPosition({ x: 0, y: 24 });
  std.writeConsole(" ".repeat(80), {
    bgColor: classicColors["lightGray"],
    fgColor: classicColors["black"],
  });
  std.setConsoleCursorPosition({ x: 0, y: 24 });
  std.writeConsole(" F1 - menu │ ESC - quit │");
  std.resetConsoleAttributes();
};

class PaintCtx {
  public buffer: string[][] = [[]];

  public cursorX: number = 0;
  public cursorY: number = 0;
  public imageWidth: number = 0;
  public imageHeight: number = 0;

  constructor() {}

  public setImageSize(width: number, height: number) {
    const buffer = [];
    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) {
        row.push("☺");
      }
      buffer.push(row);
    }
    this.buffer = buffer;
  }
}

class Paint extends State {
  private pc: PC;
  private std: Std;
  private p: PaintCtx;

  private isDirty: boolean = false;

  constructor(pc: PC, p: PaintCtx) {
    super();

    this.pc = pc;
    this.std = pc.std;
    this.p = p;
  }

  private drawStatusLine() {
    printStatusLine(this.std, " F1 - menu │ ESC - quit │");
  }

  override update(dt: number) {
    const std = this.std;

    std.resetConsoleAttributes();
    std.clearConsole();

    std.setConsoleCursorPosition({ x: this.p.cursorX, y: this.p.cursorY });
    std.writeConsole("X");
    std.setConsoleCursorPosition({ x: this.p.cursorX, y: this.p.cursorY });
    std.updateConsoleAttributes({
      blink: true,
      underline: true,
      bgColor: classicColors["red"],
    });
    std.writeConsoleAttributes();

    this.drawStatusLine();
  }
}

export class PengPaint implements Executable {
  private pc: PC;

  private stateManager: StateManager = new StateManager();

  private paintCtx: PaintCtx = new PaintCtx();

  constructor(pc: PC) {
    this.pc = pc;
  }

  private changeState(newStateKey: GameStateKey, shouldPush: boolean = false) {
    let newState = null;

    switch (newStateKey) {
      case GameStateKey.Paint:
        newState = new Paint(this.pc, this.paintCtx);
        break;
    }

    if (!newState) {
      throw new Error("Cannot create new state.");
    }

    if (shouldPush) {
      this.stateManager.pushState(newState);
    } else {
      this.stateManager.replaceState(newState);
    }
  }

  async run(args: string[]) {
    const { std } = this.pc;

    std.resetConsole();
    std.clearConsole();
    std.setIsConsoleCursorVisible(false);

    this.paintCtx.setImageSize(5, 5);

    this.changeState(GameStateKey.Paint);

    return new Promise<void>((resolve) => {
      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        this.stateManager.update(dt);

        if (this.stateManager.getIsEmpty()) {
          std.resetConsole();
          std.clearConsole();
          resolve();
          return;
        }

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
