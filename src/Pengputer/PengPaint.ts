import { classicColors } from "../Color/ansi";
import { Std } from "../Std";
import { Signal } from "../Toolbox/Signal";
import { State, StateManager } from "../Toolbox/StateManager";
import { Vector } from "../Toolbox/Vector";
import { Rect, Size } from "../types";
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
  std.writeConsole(string);
  std.resetConsoleAttributes();
};

class PaintCtx {
  public buffer: string[][] = [[]];

  public screenRect: Rect = { x: 0, y: 0, w: 5, h: 5 };

  public windowOrigin: Vector = { x: 0, y: 0 };

  /* in image */
  public cursorPosition: Vector = { x: 0, y: 0 };

  public imageSize: Size = { w: 0, h: 0 };

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

    this.imageSize.w = width;
    this.imageSize.h = height;
  }
}

class Paint extends State {
  private pc: PC;
  private std: Std;
  private ctx: PaintCtx;

  private isDirty: boolean = false;

  public signal: Signal<"quit"> = new Signal();

  constructor(pc: PC, ctx: PaintCtx) {
    super();

    this.pc = pc;
    this.std = pc.std;
    this.ctx = ctx;
  }

  private drawStatusLine() {
    printStatusLine(this.std, " F1 - menu │ ESC - quit │");
  }

  private drawBuffer() {
    const { std, ctx } = this;

    const consoleSize = this.std.getConsoleSize();
    consoleSize.h - 1; // for status line

    for (let y = 0; y < ctx.imageSize.h && y < consoleSize.h; y += 1) {
      for (let x = 0; x < ctx.imageSize.w && x < consoleSize.w; x += 1) {
        std.setConsoleCursorPosition({ x, y });
        std.writeConsole(ctx.buffer[y][x]);
      }
    }
  }

  override update(dt: number) {
    const { std, ctx } = this;

    // input

    if (this.getIsFocused()) {
      while (true) {
        const ev = std.getNextKeyboardEvent();
        if (!ev) break;

        if (!ev.pressed) continue;

        if (ev.code === "ArrowLeft") {
          ctx.cursorPosition.x -= 1;
        }
        if (ev.code === "ArrowRight") {
          ctx.cursorPosition.x += 1;
        }
        if (ev.code === "ArrowUp") {
          ctx.cursorPosition.y -= 1;
        }
        if (ev.code === "ArrowDown") {
          ctx.cursorPosition.y += 1;
        }

        if (ev.code === "Escape") {
          this.signal.emit("quit");
        }
      }
    }

    // render

    std.resetConsoleAttributes();
    std.clearConsole();

    this.drawBuffer();

    this.drawStatusLine();

    std.setConsoleCursorPosition({
      x: ctx.cursorPosition.x,
      y: ctx.cursorPosition.y,
    });
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
        newState.signal.listen((s) => {
          if (s === "quit") {
            this.stateManager.popState();
          }
        });
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
