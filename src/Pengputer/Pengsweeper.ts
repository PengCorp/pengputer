import _ from "lodash";
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
  position: Vector;
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
  private flagCount: number;
  private cursor: Vector | null;
  private isFirstCellOpened: boolean;

  private field!: FieldCell[];

  private needsRedraw: boolean;

  constructor(pc: PC, options: { difficultyLevel: DifficultyLevel }) {
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

  private openCell(pos: Vector) {
    const cell = this.getCell(pos);

    if (!cell || cell.isFlagged) return;

    if (!this.isFirstCellOpened && cell.isMine) {
      this.generateField();
      this.openCell(pos);
      return;
    }

    if (cell.isOpened && cell.adjacentMines > 0) {
      const adjacentCells = this.getAdjacentCells(pos);
      const flaggedCount = adjacentCells.filter(
        (cell) => cell.isFlagged
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
  }

  private checkWin() {
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
      if (this.cursor) {
        this.openCell(this.cursor);
      }
    }
    if (std.getWasKeyPressed("KeyF")) {
      if (this.cursor) {
        this.toggleCellFlag(this.cursor);
      }
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

  private getCell(pos: Vector) {
    if (
      !getIsVectorInRect(
        pos,
        getRectFromVectorAndSize(zeroVector, this.fieldSize)
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
          (c) => c.isMine
        ).length;
        cell.adjacentMines = mineCount;
      }
    }

    this.flagCount = 0;
    this.isFirstCellOpened = false;

    this.needsRedraw = true;
  }

  private redraw() {
    this.drawCounts();
    this.drawBoard();
  }

  private drawCounts() {
    const { std } = this.pc;

    std.setConsoleCursorPosition({ x: 0, y: 0 });
    std.writeConsole(
      `Mines left: ${_.padStart(String(this.minesCount - this.flagCount), 2)}`
    );
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
        attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Black];

        let cellString = "X";

        if (!cell.isOpened) {
          if (cell.isFlagged) {
            attributes.bgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.Black];
            cellString = "?";
          } else {
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
            cellString = ".";
          }
        } else {
          if (cell.isMine && cell.isFlagged) {
            attributes.bgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.Black];
            cellString = "@";
          } else if (cell.isMine && !cell.isFlagged) {
            if (cell.isExploded) {
              attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Red];
              attributes.fgColor = CGA_PALETTE_DICT[CgaColors.White];
              cellString = "@";
            } else {
              attributes.bgColor = CGA_PALETTE_DICT[CgaColors.Red];
              attributes.fgColor = CGA_PALETTE_DICT[CgaColors.Black];
              cellString = "@";
            }
          } else if (!cell.isMine && cell.isFlagged) {
            attributes.bgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.Black];

            cellString = " ";
          } else if (cell.adjacentMines > 0) {
            attributes.fgColor = NUMBER_COLORS[cell.adjacentMines];
            cellString = String(cell.adjacentMines);
          } else {
            attributes.fgColor = CGA_PALETTE_DICT[CgaColors.LightGray];
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
