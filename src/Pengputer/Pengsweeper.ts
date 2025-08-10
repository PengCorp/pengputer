import _ from "lodash";
import {
  classicColors,
  indexedColors,
  namedColors,
  uniqueColors,
} from "@Color/ansi";
import { type Color, ColorType } from "@Color/Color";
import { type ClickListener } from "../Screen/Screen";
import { Signal } from "@Toolbox/Signal";
import { State, StateManager } from "@Toolbox/StateManager";
import {
  type Vector,
  vectorAdd,
  vectorClamp,
  vectorSubtract,
  zeroVector,
} from "@Toolbox/Vector";
import {
  getIsVectorInRect,
  getRectFromVectorAndSize,
  type Size,
} from "../types";
import { type Executable } from "./FileSystem";
import { type PC } from "./PC";

enum GameStateKey {
  MainMenu,
  Pengsweeper,
  Help,
}

enum DifficultyLevel {
  Beginner,
  Intermediate,
  Expert,
}

interface FieldCell {
  isMine: boolean;
  isExploded: boolean;
  isFlagged: boolean;
  isOpened: boolean;
  adjacentMines: number;
  position: Vector;
}

const CELL_SIZE: Size = { w: 3, h: 1 };

const NUMBER_COLORS: Record<string, Color> = {
  "1": classicColors["azure"],
  "2": classicColors["green"],
  "3": classicColors["lightRed"],
  "4": classicColors["lightViolet"],
  "5": classicColors["lightOrange"],
  "6": classicColors["cyan"],
  "7": classicColors["lightBlue"],
  "8": classicColors["white"],
};

type PengsweeperSignalData =
  | {
      key: "reset";
    }
  | { key: "help" }
  | { key: "quit" };

class Pengsweeper extends State {
  private pc: PC;

  private fieldSize: Size;
  private minesCount: number;
  private flagCount: number;
  private cursor: Vector | null;
  private isFirstCellOpened: boolean;

  private field!: FieldCell[];

  private needsRedraw: boolean;
  private isWin: boolean = false;
  private isLoss: boolean = false;

  public signal = new Signal<PengsweeperSignalData>();

  constructor(pc: PC, options: { difficultyLevel: DifficultyLevel }) {
    super();

    this.pc = pc;
    this.needsRedraw = true;
    this.cursor = { x: 0, y: 0 };
    this.isFirstCellOpened = false;
    this.flagCount = 0;

    const { difficultyLevel } = options;

    switch (difficultyLevel) {
      case DifficultyLevel.Beginner:
        this.fieldSize = { w: 9, h: 9 };
        this.minesCount = 10;
        break;
      case DifficultyLevel.Intermediate:
        this.fieldSize = { w: 16, h: 16 };
        this.minesCount = 40;
        break;
      case DifficultyLevel.Expert:
        this.fieldSize = { w: 25, h: 16 };
        this.minesCount = 80;
        break;
    }

    this.generateField();
  }

  private unsubscribeFromClicks!: () => void;

  override onEnter() {
    super.onEnter();

    const { std } = this.pc;
    const clickListener: ClickListener = ({ position }) => {
      const boardPosition = vectorSubtract(position, this.getFieldOrigin());
      if (
        getIsVectorInRect(
          boardPosition,
          getRectFromVectorAndSize(zeroVector, {
            w: this.fieldSize.w * CELL_SIZE.w,
            h: this.fieldSize.h * CELL_SIZE.h,
          }),
        )
      ) {
        this.cursor = {
          x: Math.floor(boardPosition.x / CELL_SIZE.w),
          y: Math.floor(boardPosition.y / CELL_SIZE.h),
        };
        this.needsRedraw = true;
      }
    };
    this.unsubscribeFromClicks = std.addMouseScreenClickListener(clickListener);
  }

  override onLeave() {
    super.onLeave();

    this.unsubscribeFromClicks();
  }

  override onFocus() {
    super.onFocus();

    const { std } = this.pc;

    std.resetConsole();
    std.clearConsole();
    std.setIsConsoleCursorVisible(false);
    std.flushKeyboardEvents();

    this.needsRedraw = true;
  }

  override onBlur() {
    super.onBlur();
  }

  private moveCursor(delta: Vector) {
    if (!this.cursor) return;

    this.cursor = vectorClamp(
      vectorAdd(this.cursor, delta),
      getRectFromVectorAndSize(zeroVector, this.fieldSize),
    );

    this.needsRedraw = true;
  }

  private openCell(pos: Vector) {
    const cell = this.getCell(pos);

    if (!cell || cell.isFlagged) return;

    if (!this.isFirstCellOpened && cell.isMine) {
      this.generateField();
      this.openCell(pos);
      return;
    }

    this.isFirstCellOpened = true;

    if (cell.isOpened && cell.adjacentMines > 0) {
      const adjacentCells = this.getAdjacentCells(pos);
      const flaggedCount = adjacentCells.filter(
        (cell) => cell.isFlagged,
      ).length;
      if (flaggedCount === cell.adjacentMines) {
        for (const adjacentCell of adjacentCells) {
          if (!adjacentCell.isFlagged && !adjacentCell.isOpened) {
            this.openCell(adjacentCell.position);
          }
        }
      }
    }

    cell.isOpened = true;

    if (!cell.isMine && cell.adjacentMines === 0) {
      const adjacentCells = this.getAdjacentCells(pos);

      for (const adjacentCell of adjacentCells) {
        if (!adjacentCell.isOpened) {
          this.openCell(adjacentCell.position);
        }
      }
    }

    if (cell.isMine) {
      this.explodeCell(cell.position);
    }

    this.needsRedraw = true;

    this.checkWin();
  }

  private toggleCellFlag(pos: Vector) {
    const cell = this.getCell(pos);

    if (!cell || cell.isOpened) return;

    if (cell.isFlagged) {
      cell.isFlagged = false;
      this.flagCount -= 1;
    } else {
      cell.isFlagged = true;
      this.flagCount += 1;
    }

    this.needsRedraw = true;
  }

  private explodeCell(pos: Vector) {
    const explodedCell = this.getCell(pos);

    if (!explodedCell || !explodedCell.isMine) {
      throw new Error("Attempting to explode a mine that does not exist.");
    }

    explodedCell.isExploded = true;

    this.reveal();
    this.isLoss = true;
  }

  private checkWin() {
    if (this.isLoss) {
      return;
    }

    let existCovered = false;
    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const cell = this.getCell({ x, y })!;

        if (!cell.isOpened && !cell.isMine) {
          existCovered = true;
        }
      }
    }

    if (existCovered) {
      return;
    }

    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const cell = this.getCell({ x, y })!;

        if (cell.isMine && !cell.isFlagged) {
          this.toggleCellFlag(cell.position);
        }
      }
    }

    this.reveal();
    this.isWin = true;
  }

  private reveal() {
    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const cell = this.getCell({ x, y })!;

        if (cell.isMine || cell.isFlagged) {
          cell.isOpened = true;
        }
      }
    }

    this.cursor = null;

    this.needsRedraw = true;
  }

  override update(dt: number) {
    super.update(dt);

    const { std } = this.pc;
    if (this.getIsFocused()) {
      while (true) {
        const ev = std.getNextKeyboardEvent();
        if (!ev) break;
        if (ev.isModifier || !ev.pressed) continue;

        if (ev.code === "ArrowRight") {
          this.moveCursor({ x: 1, y: 0 });
        }
        if (ev.code === "ArrowLeft") {
          this.moveCursor({ x: -1, y: 0 });
        }
        if (ev.code === "ArrowUp") {
          this.moveCursor({ x: 0, y: -1 });
        }
        if (ev.code === "ArrowDown") {
          this.moveCursor({ x: 0, y: 1 });
        }
        if (ev.code === "Space") {
          if (this.cursor) {
            this.openCell(this.cursor);
          }
        }
        if (ev.code === "KeyF") {
          if (this.cursor) {
            this.toggleCellFlag(this.cursor);
          }
        }
        if (ev.code === "KeyR") {
          this.signal.emit({ key: "reset" });
        }
        if (ev.code === "F1") {
          this.signal.emit({ key: "help" });
        }
        if (ev.code === "Escape") {
          this.signal.emit({ key: "quit" });
        }
      }
    }

    if (this.needsRedraw) {
      this.redraw();
      this.needsRedraw = false;
    }
  }

  private getFieldOrigin() {
    const { std } = this.pc;

    const screenSize = std.getConsoleSize();

    return {
      x: Math.floor((screenSize.w - this.fieldSize.w * CELL_SIZE.w) / 2),
      y: Math.floor((screenSize.h - this.fieldSize.h * CELL_SIZE.h) / 2),
    };
  }

  private getCell(pos: Vector) {
    if (
      !getIsVectorInRect(
        pos,
        getRectFromVectorAndSize(zeroVector, this.fieldSize),
      )
    )
      return null;

    return this.field[pos.y * this.fieldSize.w + pos.x];
  }

  private getAdjacentCells(pos: Vector) {
    return [
      this.getCell(vectorAdd(pos, { x: -1, y: -1 })),
      this.getCell(vectorAdd(pos, { x: 0, y: -1 })),
      this.getCell(vectorAdd(pos, { x: 1, y: -1 })),
      this.getCell(vectorAdd(pos, { x: -1, y: 0 })),
      this.getCell(vectorAdd(pos, { x: 1, y: 0 })),
      this.getCell(vectorAdd(pos, { x: -1, y: 1 })),
      this.getCell(vectorAdd(pos, { x: 0, y: 1 })),
      this.getCell(vectorAdd(pos, { x: 1, y: 1 })),
    ].filter((c) => c !== null);
  }

  private generateField() {
    this.field = new Array(this.fieldSize.w * this.fieldSize.h)
      .fill(null)
      .map<FieldCell>((c, i) => ({
        isFlagged: false,
        isMine: false,
        isOpened: false,
        isExploded: false,
        adjacentMines: 0,
        position: {
          x: i % this.fieldSize.w,
          y: Math.floor(i / this.fieldSize.w),
        },
      }));

    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const cell = this.getCell({ x, y });
        if (!cell) continue;
        cell.isOpened = false;
        cell.isMine = false;
        cell.adjacentMines = 0;
        cell.isExploded = false;
        cell.isFlagged = false;
      }
    }

    let minesAdded = 0;
    while (minesAdded < this.minesCount) {
      const x = _.random(0, this.fieldSize.w - 1);
      const y = _.random(0, this.fieldSize.h - 1);
      const cell = this.getCell({ x, y });
      if (!cell || cell.isMine) {
        continue;
      }

      cell.isMine = true;
      minesAdded += 1;
    }

    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const cell = this.getCell({ x, y });
        if (!cell) continue;
        const mineCount = this.getAdjacentCells({ x, y }).filter(
          (c) => c.isMine,
        ).length;
        cell.adjacentMines = mineCount;
      }
    }

    this.flagCount = 0;
    this.isFirstCellOpened = false;

    this.needsRedraw = true;
  }

  private redraw() {
    this.drawStatus();
    this.drawBoard();
  }

  private drawStatus() {
    const { std } = this.pc;

    std.setConsoleCursorPosition({ x: 0, y: 0 });
    std.writeConsole("Mines left: ");
    std.writeConsole(_.padStart(String(this.minesCount - this.flagCount), 3), {
      fgColor: classicColors["lightRed"],
      bgColor: indexedColors[52],
    });
    std.resetConsoleAttributes();
    std.writeConsole(" ");

    std.writeConsole("<F1>", { bold: true });
    std.resetConsoleAttributes();
    std.writeConsole(" for help. ");

    std.writeConsole("<esc>", { bold: true });
    std.resetConsoleAttributes();
    std.writeConsole(" to quit. ");

    std.writeConsole("<r>", { bold: true });
    std.resetConsoleAttributes();
    std.writeConsole(" to restart.");

    if (this.isWin) {
      const screenSize = std.getConsoleSize();
      std.setConsoleCursorPosition({ x: screenSize.w - 8, y: 0 });
      std.writeConsole("You win!");
    } else if (this.isLoss) {
      const screenSize = std.getConsoleSize();
      std.setConsoleCursorPosition({ x: screenSize.w - 5, y: 0 });
      std.writeConsole("Oops!");
    }
  }

  private drawBoard() {
    const { std } = this.pc;

    const fieldOrigin = this.getFieldOrigin();

    for (let y = 0; y < this.fieldSize.h; y += 1) {
      for (let x = 0; x < this.fieldSize.w; x += 1) {
        const idx = y * this.fieldSize.w + x;
        std.setConsoleCursorPosition({
          x: fieldOrigin.x + x * CELL_SIZE.w,
          y: fieldOrigin.y + y * CELL_SIZE.h,
        });
        const cell = this.field[idx];

        const previousAttributes = std.getConsoleAttributes();

        const attributes = std.getConsoleAttributes();
        attributes.bgColor = classicColors["black"];

        let cellString = "X";

        if (!cell.isOpened) {
          if (cell.isFlagged) {
            attributes.bgColor = classicColors["lightGray"];
            attributes.fgColor = classicColors["black"];
            cellString = "?";
          } else {
            attributes.fgColor = classicColors["lightGray"];
            cellString = ".";
          }
        } else {
          if (cell.isMine && cell.isFlagged) {
            attributes.bgColor = classicColors["lightGray"];
            attributes.fgColor = classicColors["black"];
            cellString = "@";
          } else if (cell.isMine && !cell.isFlagged) {
            if (cell.isExploded) {
              attributes.bgColor = classicColors["red"];
              attributes.fgColor = classicColors["white"];
              cellString = "@";
            } else {
              attributes.bgColor = classicColors["red"];
              attributes.fgColor = classicColors["black"];
              cellString = "@";
            }
          } else if (!cell.isMine && cell.isFlagged) {
            attributes.bgColor = classicColors["lightGray"];
            attributes.fgColor = classicColors["black"];

            cellString = "_";
          } else if (cell.adjacentMines > 0) {
            attributes.fgColor = NUMBER_COLORS[cell.adjacentMines];
            cellString = String(cell.adjacentMines);
          } else {
            attributes.fgColor = classicColors["lightGray"];
            cellString = " ";
          }
        }

        if (cell.isOpened && cell.isMine && cell.isExploded) {
          cellString = `>@<`;
        } else if (this.cursor && x === this.cursor.x && y === this.cursor.y) {
          cellString = `[${cellString}]`;
        } else {
          cellString = ` ${cellString} `;
        }

        std.setConsoleAttributes(attributes);
        std.writeConsole(cellString);

        std.setConsoleAttributes(previousAttributes);
      }
    }
  }
}

type HelpSignalData = { key: "exit" };

class Help extends State {
  private pc: PC;
  public signal: Signal<HelpSignalData> = new Signal();

  constructor(pc: PC) {
    super();

    this.pc = pc;
  }

  override onEnter() {
    super.onEnter();

    const { std } = this.pc;

    std.flushKeyboardEvents();
  }

  override onFocus() {
    super.onFocus();

    const { std } = this.pc;
    std.resetConsole();
    std.clearConsole();
    std.setIsConsoleCursorVisible(false);
    std.writeConsole("== Pengsweeper ==\n", { bold: true });
    std.writeConsole("\n", { bold: false });
    std.writeConsole("Use <space> to uncover fields.\n");
    std.writeConsole(
      "Use <f> to flag fields if you think they contain a mine.\n",
    );
    std.writeConsole("\n");
    std.writeConsole(
      "Each field is either empty, contains a mine or contains a number that shows how\n",
    );
    std.writeConsole("many adjacent mines there are.\n");
    std.writeConsole("\n");
    std.writeConsole(
      "If you try to open a field that has the same number of flags as its value\n",
    );
    std.writeConsole(
      "all adjacent unflagged fields will be opened. If your flag was not correct\n",
    );
    std.writeConsole("this can open a mine!\n");
    std.writeConsole("\n");
    std.writeConsole(
      "Game is complete when all fields that don't contain a mine are opened.\n",
    );
    std.writeConsole("\n");
    std.writeConsole("Press any key to continue...", { bold: true });
  }

  override update(dt: number) {
    super.update(dt);

    const { std } = this.pc;

    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;
      if (!ev.isModifier && ev.pressed) {
        this.signal.emit({ key: "exit" });
      }
    }
  }
}

type MainMenuSignalData =
  | { key: "exit" }
  | { key: "select"; value: "1" | "2" | "3" };

class MainMenu extends State {
  private pc: PC;
  public signal: Signal<MainMenuSignalData> = new Signal();

  constructor(pc: PC) {
    super();

    this.pc = pc;
  }

  override onFocus() {
    super.onFocus();

    const { std } = this.pc;
    std.resetConsole();
    std.clearConsole();
    std.setIsConsoleCursorVisible(false);
    std.writeConsole("== Pengsweeper ==\n", { bold: true });
    std.writeConsole("\n", { reset: true });
    std.writeConsole("Select your difficulty level:\n\n");
    std.writeConsole("  1) beginner\n");
    std.writeConsole("  2) intermediate\n");
    std.writeConsole("  3) expert\n");
    std.writeConsole("\n");
    std.writeConsole("or press ");
    std.writeConsole("<esc>", { bold: true });
    std.writeConsole(" to exit.", { reset: true });
    std.writeConsole("\n\n");
    std.writeConsole("Programming: ");
    std.writeConsole("Strawberry\n", { fgColor: uniqueColors["strawberry"] });
    std.resetConsoleAttributes();
    std.writeConsole("Inspired by: ");
    std.writeConsole("Alexey Kutepov\n", {
      fgColor: classicColors["lightSpringGreen"],
    });
    std.resetConsoleAttributes();
    std.flushKeyboardEvents();
  }

  override update(dt: number) {
    super.update(dt);

    const { std } = this.pc;

    if (!this.getIsFocused()) {
      return;
    }

    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;
      if (ev.isModifier || !ev.pressed) continue;

      if (ev.code === "Digit1" || ev.code === "Numpad1") {
        this.signal.emit({ key: "select", value: "1" });
      }
      if (ev.code === "Digit2" || ev.code === "Numpad2") {
        this.signal.emit({ key: "select", value: "2" });
      }
      if (ev.code === "Digit3" || ev.code === "Numpad3") {
        this.signal.emit({ key: "select", value: "3" });
      }
      if (ev.code === "Escape") {
        this.signal.emit({ key: "exit" });
      }
    }
  }
}

export class PengsweeperApp implements Executable {
  private pc: PC;

  private stateManager: StateManager = new StateManager();

  private difficultyLevel: DifficultyLevel = DifficultyLevel.Beginner;

  constructor(pc: PC) {
    this.pc = pc;
  }

  private changeState(newStateKey: GameStateKey, shouldPush: boolean = false) {
    let newState = null;

    switch (newStateKey) {
      case GameStateKey.MainMenu:
        newState = new MainMenu(this.pc);
        newState.signal.listen((s) => {
          if (s.key === "select") {
            switch (s.value) {
              case "1":
                this.difficultyLevel = DifficultyLevel.Beginner;
                break;
              case "2":
                this.difficultyLevel = DifficultyLevel.Intermediate;
                break;
              case "3":
                this.difficultyLevel = DifficultyLevel.Expert;
                break;
            }
            this.changeState(GameStateKey.Pengsweeper, true);
          }
          if (s.key === "exit") {
            this.stateManager.popState();
          }
        });
        break;
      case GameStateKey.Pengsweeper:
        newState = new Pengsweeper(this.pc, {
          difficultyLevel: this.difficultyLevel,
        });
        newState.signal.listen((s) => {
          if (s.key === "reset") {
            this.changeState(GameStateKey.Pengsweeper);
          } else if (s.key === "help") {
            this.changeState(GameStateKey.Help, true);
          } else if (s.key === "quit") {
            this.stateManager.popState();
          }
        });
        break;
      case GameStateKey.Help:
        newState = new Help(this.pc);
        newState.signal.listen((s) => {
          if (s.key === "exit") {
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

    this.changeState(GameStateKey.MainMenu);

    return new Promise<void>((resolve) => {
      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        this.stateManager.update(dt);

        if (this.stateManager.getIsEmpty()) {
          std.clearConsole();
          std.writeConsole("Thank you for playing!\n");
          resolve();
          return;
        }

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
