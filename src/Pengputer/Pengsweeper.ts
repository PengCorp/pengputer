import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { ClickListener } from "../Screen/Screen";
import {
  Vector,
  vectorAdd,
  vectorClamp,
  vectorSubtract,
  zeroVector,
} from "../Toolbox/Vector";
import { getIsVectorInRect, getRectFromVectorAndSize, Size } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

interface GameState {
  onEnter: () => void;
  update: (dt: number) => void;
  onLeave: () => void;
}

enum GameStateKey {
  Pengsweeper,
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
}

const CELL_SIZE: Size = { w: 3, h: 1 };

const NUMBER_COLORS: Record<string, string> = {
  "1": CGA_PALETTE_DICT[CgaColors.Azure],
  "2": CGA_PALETTE_DICT[CgaColors.Green],
  "3": CGA_PALETTE_DICT[CgaColors.LightRed],
  "4": CGA_PALETTE_DICT[CgaColors.LightViolet],
  "5": CGA_PALETTE_DICT[CgaColors.LightOrange],
  "6": CGA_PALETTE_DICT[CgaColors.Cyan],
  "7": CGA_PALETTE_DICT[CgaColors.LightBlue],
  "8": CGA_PALETTE_DICT[CgaColors.White],
};

class Pengsweeper implements GameState {
  private pc: PC;

  private fieldSize: Size;
  private minesCount: number;
  private cursor: Vector | null;

  private field!: FieldCell[];

  private needsRedraw: boolean;

  constructor(pc: PC, options: { difficultyLevel: DifficultyLevel }) {
    this.pc = pc;
    this.needsRedraw = true;
    this.cursor = { x: 0, y: 0 };

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

    this.makeGrid();
  }

  private unsubscribeFromClicks!: () => void;

  onEnter() {
    const { std } = this.pc;
    const clickListener: ClickListener = ({ position }) => {
      const boardPosition = vectorSubtract(position, this.getFieldOrigin());
      if (
        getIsVectorInRect(
          boardPosition,
          getRectFromVectorAndSize(zeroVector, {
            w: this.fieldSize.w * CELL_SIZE.w,
            h: this.fieldSize.h * CELL_SIZE.h,
          })
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

  onLeave() {
    this.unsubscribeFromClicks();
  }

  private moveCursor(delta: Vector) {
    if (!this.cursor) return;

    this.cursor = vectorClamp(
      vectorAdd(this.cursor, delta),
      getRectFromVectorAndSize(zeroVector, this.fieldSize)
    );
    this.needsRedraw = true;
  }

  private openCell() {
    if (!this.cursor) return;
    const cell = this.field[this.cursor.y * this.fieldSize.w + this.cursor.x];
    if (cell.isOpened) return;

    cell.isOpened = true;
    this.needsRedraw = true;
  }

  update(dt: number) {
    const { std } = this.pc;
    if (std.getWasKeyPressed("ArrowRight")) {
      this.moveCursor({ x: 1, y: 0 });
    }
    if (std.getWasKeyPressed("ArrowLeft")) {
      this.moveCursor({ x: -1, y: 0 });
    }
    if (std.getWasKeyPressed("ArrowUp")) {
      this.moveCursor({ x: 0, y: -1 });
    }
    if (std.getWasKeyPressed("ArrowDown")) {
      this.moveCursor({ x: 0, y: 1 });
    }
    if (std.getWasKeyPressed("Space")) {
      this.openCell();
    }
    std.resetKeyPressedHistory();

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

  private redraw() {
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
        attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];

        if (cell.isFlagged) {
          attributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightRed];
        } else if (!cell.isOpened) {
          attributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
        } else if (cell.isMine) {
          if (cell.isExploded) {
            attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Red];
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.White];
          } else {
            attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Red];
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.Black];
          }
        } else if (cell.adjacentMines > 0) {
          attributes.fgColor = NUMBER_COLORS[cell.adjacentMines];
        } else {
          attributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
        }

        let cellString = "X";

        std.setConsoleAttributes(attributes);

        if (cell.isFlagged) {
          cellString = "?";
        } else if (!cell.isOpened) {
          cellString = ".";
        } else if (cell.isMine) {
          cellString = "@";
        } else if (cell.adjacentMines > 0) {
          cellString = String(cell.adjacentMines);
        } else if (cell.isOpened) {
          cellString = " ";
        }

        if (this.cursor && x === this.cursor.x && y === this.cursor.y) {
          cellString = `[${cellString}]`;
        } else {
          cellString = ` ${cellString} `;
        }

        std.writeConsole(cellString);

        std.setConsoleAttributes(previousAttributes);
      }
    }
  }

  private makeGrid() {
    this.field = new Array(this.fieldSize.w * this.fieldSize.h)
      .fill(null)
      .map(() => ({
        isFlagged: false,
        isMine: false,
        isOpened: false,
        isExploded: false,
        adjacentMines: 0,
      }));
  }
}

export class PengsweeperApp implements Executable {
  private pc: PC;

  private currentState: GameState | null = null;
  private isQuitting: boolean = false;

  private changeState(newStateKey: GameStateKey) {
    const { std } = this.pc;
    std.resetKeyPressedHistory();
    this.currentState?.onLeave();
    switch (newStateKey) {
      case GameStateKey.Pengsweeper:
        const pengsweeper = new Pengsweeper(this.pc, {
          difficultyLevel: DifficultyLevel.Beginner,
        });
        this.currentState = pengsweeper;
        break;
    }
    this.currentState?.onEnter();
  }

  constructor(pc: PC) {
    this.pc = pc;
  }

  async run(args: string[]) {
    const { std } = this.pc;

    std.resetConsole();
    std.clearConsole();
    std.setIsConsoleCursorVisible(false);
    std.setIsConsoleScrollable(false);
    std.resetKeyPressedHistory();

    this.changeState(GameStateKey.Pengsweeper);

    return new Promise<void>((resolve) => {
      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        this.currentState?.update(dt);

        if (this.isQuitting) {
          std.clearConsole();
          std.writeConsole("Thank you for playing!\n");
          this.currentState?.onLeave();
          resolve();
          return;
        }

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
