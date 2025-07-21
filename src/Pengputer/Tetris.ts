/*
Sources:
- https://listfist.com/list-of-tetris-levels-by-speed-nes-ntsc-vs-pal
- https://tetris.wiki/Tetris_(NES)
- https://tetris.fandom.com/wiki/Nintendo_Rotation_System
- https://tetris.wiki/Tetris_Guideline
- https://tetris.wiki/Super_Rotation_System
*/

import _ from "lodash";
import { classicColors, namedColors } from "../Color/ansi";
import { Color, ColorType } from "../Color/Color";
import { wrapMax } from "../Toolbox/Math";
import { Signal } from "../Toolbox/Signal";
import {
  Vector,
  vectorAdd,
  vectorClone,
  vectorEqual,
  vectorMultiplyComponents,
  zeroVector,
} from "../Toolbox/Vector";
import {
  getIsVectorInRect,
  getRectFromVectorAndSize,
  Rect,
  Size,
} from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

const msPerFrame = 16.666666666;

interface GameState {
  onEnter: () => void;
  update: (dt: number) => void;
  onLeave: () => void;
}

interface Level {
  msPerCell: number;
}

const levels: Level[] = [
  { msPerCell: 48 * msPerFrame },
  { msPerCell: 43 * msPerFrame },
  { msPerCell: 38 * msPerFrame },
  { msPerCell: 33 * msPerFrame },
  { msPerCell: 28 * msPerFrame },
  { msPerCell: 23 * msPerFrame },
  { msPerCell: 18 * msPerFrame },
  { msPerCell: 13 * msPerFrame },
  { msPerCell: 8 * msPerFrame },
  { msPerCell: 6 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
  { msPerCell: 0 * msPerFrame },
];

const WIDTH = 10;
const HEIGHT = 40;
const TOP_PADDING = 20;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const BORDER_SIZE_H = 2;
const BORDER_SIZE_V = 1;
const NUM_CELLS = WIDTH * HEIGHT;
const BOARD_RECT: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

const DAS_DELAY_LENGTH = 10 * msPerFrame;
const DAS_LENGTH = 2 * msPerFrame;
const ARE_DELAY = 6 * msPerFrame;
const PUSHDOWN_LENGTH = 1 * msPerFrame;
const LOCK_DELAY = 30 * msPerFrame;

enum PieceKey {
  I = "I",
  O = "O",
  J = "J",
  L = "L",
  S = "S",
  T = "T",
  Z = "Z",
}

const sevenBag = [
  PieceKey.I,
  PieceKey.O,
  PieceKey.J,
  PieceKey.L,
  PieceKey.S,
  PieceKey.T,
  PieceKey.Z,
];

interface PieceColor {
  bgColor: Color;
  fgColor: Color;
}

interface PieceDescriptor {
  key: PieceKey;
  size: Size;
  rotations: Array<string>;
  spawnPosition: Vector;
  nextOffset: Vector;
  color: PieceColor;
}

enum Rotation {
  Zero = 0,
  Right = 1,
  Two = 2,
  Left = 3,
}
const NUM_ROTATIONS = 4;

const wallKickRegular: Record<
  Rotation,
  Partial<Record<Rotation, Array<Vector>>>
> = {
  [Rotation.Zero]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: +2 },
      { x: -1, y: +2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: -1 },
      { x: 0, y: +2 },
      { x: +1, y: +2 },
    ],
  },
  [Rotation.Right]: {
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: +1 },
      { x: 0, y: -2 },
      { x: +1, y: -2 },
    ],
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: +1 },
      { x: 0, y: -2 },
      { x: +1, y: -2 },
    ],
  },
  [Rotation.Two]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: +2 },
      { x: -1, y: +2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: -1 },
      { x: 0, y: +2 },
      { x: +1, y: +2 },
    ],
  },
  [Rotation.Left]: {
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: +1 },
      { x: 0, y: -2 },
      { x: -1, y: -2 },
    ],
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: +1 },
      { x: 0, y: -2 },
      { x: -1, y: -2 },
    ],
  },
};

const wallKickI: Record<Rotation, Partial<Record<Rotation, Array<Vector>>>> = {
  [Rotation.Zero]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: +1 },
      { x: +1, y: -2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: -2 },
      { x: +2, y: +1 },
    ],
  },
  [Rotation.Right]: {
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: -1 },
      { x: -1, y: +2 },
    ],
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: -2 },
      { x: +2, y: +1 },
    ],
  },
  [Rotation.Two]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: +2 },
      { x: -2, y: -1 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: -1 },
      { x: -1, y: +2 },
    ],
  },
  [Rotation.Left]: {
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: +1 },
      { x: +1, y: -2 },
    ],
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: +2 },
      { x: -2, y: -1 },
    ],
  },
};

const pieceDescriptors: Record<PieceKey, PieceDescriptor> = {
  [PieceKey.I]: {
    key: PieceKey.I,
    size: { w: 4, h: 4 },
    rotations: [
      "    XXXX        ",
      "  X   X   X   X ",
      "        XXXX    ",
      " X   X   X   X  ",
    ],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 0 },
    color: {
      fgColor: classicColors["cyan"],
      bgColor: classicColors["lightCyan"],
    },
  },
  [PieceKey.O]: {
    key: PieceKey.O,
    size: { w: 2, h: 2 },
    rotations: ["XXXX"],
    spawnPosition: { x: 4, y: -1 + TOP_PADDING },
    nextOffset: { x: 1, y: 1 },
    color: {
      fgColor: classicColors["yellow"],
      bgColor: classicColors["lightYellow"],
    },
  },
  [PieceKey.J]: {
    key: PieceKey.J,
    size: { w: 3, h: 3 },
    rotations: ["X  XXX   ", " XX X  X ", "   XXX  X", " X  X XX "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: classicColors["blue"],
      bgColor: classicColors["lightBlue"],
    },
  },
  [PieceKey.L]: {
    key: PieceKey.L,
    size: { w: 3, h: 3 },
    rotations: ["  XXXX   ", " X  X  XX", "   XXXX  ", "XX  X  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: classicColors["orange"],
      bgColor: classicColors["lightOrange"],
    },
  },
  [PieceKey.S]: {
    key: PieceKey.S,
    size: { w: 3, h: 3 },
    rotations: [" XXXX    ", " X  XX  X", "    XXXX ", "X  XX  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: classicColors["green"],
      bgColor: classicColors["lightGreen"],
    },
  },
  [PieceKey.T]: {
    key: PieceKey.T,
    size: { w: 3, h: 3 },
    rotations: [" X XXX   ", " X  XX X ", "   XXX X ", " X XX  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: classicColors["violet"],
      bgColor: classicColors["lightViolet"],
    },
  },
  [PieceKey.Z]: {
    key: PieceKey.Z,
    size: { w: 3, h: 3 },
    rotations: ["XX  XX   ", "  X XX X ", "   XX  XX", " X XX X  "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: classicColors["red"],
      bgColor: classicColors["lightRed"],
    },
  },
};

interface Cell {
  filled: boolean;
  color: PieceColor;
}

const cellClone = (a: Cell): Cell => {
  return {
    filled: a.filled,
    color: a.color,
  };
};

class Piece {
  private descriptor: PieceDescriptor;
  private size: Size;
  public position: Vector;
  private currentRotation: Rotation;
  private grid: string;

  private ctx: Tetris;

  constructor(ctx: Tetris, piece: PieceKey) {
    this.ctx = ctx;
    this.descriptor = pieceDescriptors[piece];
    this.size = { ...this.descriptor.size };
    this.position = { ...this.descriptor.spawnPosition };

    this.currentRotation = 0;
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  public makeGhost() {
    this.descriptor = {
      ...this.descriptor,
      color: {
        fgColor: classicColors["lightGray"],
        bgColor: classicColors["black"],
      },
    };
  }

  public getDescriptor() {
    return this.descriptor;
  }

  public draw() {
    this.doForEachSquare((boardPosition) => {
      this.ctx.drawBoardSquare(boardPosition, this.descriptor.color);
    });
  }

  public doForEachSquare(
    fn: (boardPosition: Vector, localSquarePosition: Vector) => void,
  ) {
    for (let y = 0; y < this.size.h; y += 1) {
      for (let x = 0; x < this.size.w; x += 1) {
        if (this.grid[y * this.size.w + x] === "X") {
          fn(
            {
              x: this.position.x + x,
              y: this.position.y + y,
            },
            {
              x,
              y,
            },
          );
        }
      }
    }
  }

  private updateGrid() {
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  private _rotateRight() {
    this.currentRotation = wrapMax(
      this.currentRotation + 1,
      this.descriptor.rotations.length,
    );
    this.updateGrid();
  }

  private getKickSet() {
    switch (this.descriptor.key) {
      case PieceKey.J:
      case PieceKey.L:
      case PieceKey.S:
      case PieceKey.T:
      case PieceKey.Z:
        return wallKickRegular;
      case PieceKey.I:
        return wallKickI;
      case PieceKey.O:
        return null;
    }
  }

  public rotateRight() {
    const originalPosition = vectorClone(this.position);
    const startRotation = this.currentRotation;
    this._rotateRight();
    const nextRotation = this.currentRotation;
    const kickSet = this.getKickSet()?.[startRotation][nextRotation];
    if (!kickSet) return;
    for (const kick of kickSet) {
      this.position = vectorAdd(originalPosition, kick);
      if (!this.getIsColliding()) {
        return;
      }
    }
    this.position = originalPosition;
    this._rotateLeft();
  }

  private _rotateLeft() {
    this.currentRotation = wrapMax(
      this.currentRotation - 1,
      this.descriptor.rotations.length,
    );
    this.updateGrid();
  }

  public rotateLeft() {
    const originalPosition = vectorClone(this.position);
    const startRotation = this.currentRotation;
    this._rotateLeft();
    const nextRotation = this.currentRotation;
    const kickSet = this.getKickSet()?.[startRotation][nextRotation];
    if (!kickSet) return;
    for (const kick of kickSet) {
      this.position = vectorAdd(originalPosition, kick);
      if (!this.getIsColliding()) {
        return;
      }
    }
    this.position = originalPosition;
    this._rotateRight();
  }

  private getIsCollidingBoardEdges() {
    let isColliding = false;
    // add two rows to the top of the board rect for rotations
    this.doForEachSquare((pos) => {
      isColliding = isColliding || !getIsVectorInRect(pos, BOARD_RECT);
    });
    return isColliding;
  }

  private getIsCollidingBoard() {
    const board = this.ctx.getBoard();
    let isColliding = false;
    this.doForEachSquare((pos) => {
      isColliding = isColliding || Boolean(board.getCell(pos)?.filled);
    });
    return isColliding;
  }

  public getIsColliding() {
    return this.getIsCollidingBoardEdges() || this.getIsCollidingBoard();
  }

  public copyStateFrom(another: Piece) {
    this.position = vectorClone(another.position);
    this.currentRotation = another.currentRotation;
    this.updateGrid();
  }
}

class FallingPiece {
  private piece: Piece;
  private ghost: Piece;
  public onPlaced: Signal = new Signal();

  private msPerCell: number;
  private stepCounter: number;

  private direction: Vector;
  private dasDelayCounter: number;
  private dasCounter: number;

  private lockDelayCounter: number;
  private lockResetsLeft: number;

  private ctx: Tetris;

  private isPushdown: boolean;
  private pushdownLength: number;

  constructor(ctx: Tetris, piece: PieceKey, level: Level) {
    this.ctx = ctx;
    this.piece = new Piece(ctx, piece);
    this.ghost = new Piece(ctx, piece);
    this.ghost.makeGhost();

    this.msPerCell = level.msPerCell;
    this.stepCounter = this.msPerCell;

    this.direction = { x: 0, y: 0 };
    this.dasDelayCounter = DAS_DELAY_LENGTH;
    this.dasCounter = 0;

    this.isPushdown = false;
    this.pushdownLength = 0;

    this.lockDelayCounter = LOCK_DELAY;
    this.lockResetsLeft = 15;

    this.updateGhost();
  }

  public getPushdownLength() {
    return this.pushdownLength;
  }

  public draw() {
    this.ghost.draw();
    this.piece.draw();
  }

  public rotateRight() {
    this.pushdownLength = 0;
    this.resetLocking();
    this.piece.rotateRight();
    this.ghost.copyStateFrom(this.piece);
    this.updateGhost();
  }

  public rotateLeft() {
    this.pushdownLength = 0;
    this.resetLocking();
    this.piece.rotateLeft();
    this.ghost.copyStateFrom(this.piece);
    this.updateGhost();
  }

  private updateGhost() {
    this.ghost.position = vectorClone(this.piece.position);
    let hasMovedDown = false;
    while (!this.ghost.getIsColliding()) {
      this.ghost.position = vectorAdd(this.ghost.position, { x: 0, y: 1 });
      hasMovedDown = true;
    }
    if (hasMovedDown) {
      this.ghost.position = vectorAdd(this.ghost.position, { x: 0, y: -1 });
    }
  }

  private moveInDirection() {
    if (this.getIsMoving()) {
      const oldPosition = this.piece.position;
      this.piece.position = vectorAdd(this.piece.position, this.direction);
      if (this.piece.getIsColliding()) {
        this.piece.position = oldPosition;
      } else {
        this.pushdownLength = 0;
        this.updateGhost();
        this.resetLocking();
      }
    }
  }

  private getIsResting() {
    let resting = false;
    this.piece.position.y += 1;
    if (this.piece.getIsColliding()) {
      resting = true;
    }
    this.piece.position.y -= 1;
    return resting;
  }

  public step() {
    if (!this.getIsResting()) {
      this.piece.position.y += 1;
      if (this.isPushdown) {
        this.pushdownLength += 1;
      }
    }
  }

  private lock() {
    this.fillIn();
    this.onPlaced.emit();
  }

  private fillIn() {
    const board = this.ctx.getBoard();
    this.piece.doForEachSquare((pos) => {
      board.fillCell(pos, this.piece.getDescriptor().color);
    });
  }

  public setIsPushdown(isPushdown: boolean) {
    if (!isPushdown && !this.getIsResting()) {
      this.pushdownLength = 0;
    }

    if (this.isPushdown !== isPushdown) {
      this.isPushdown = isPushdown;
      this.stepCounter = this.isPushdown ? 0 : this.msPerCell;
    }
  }

  public update(dt: number) {
    this.stepCounter -= dt;
    if (this.msPerCell === 0) {
      while (!this.getIsResting()) {
        this.step();
      }
    } else {
      while (this.stepCounter <= 0) {
        this.stepCounter += this.isPushdown ? PUSHDOWN_LENGTH : this.msPerCell;
        this.step();
      }
    }

    if (this.getIsResting()) {
      this.lockDelayCounter -= dt;
      if (this.lockDelayCounter <= 0) {
        this.lock();
      }
    }

    let moveDt = dt;
    if (this.getIsMoving()) {
      if (this.dasDelayCounter > 0) {
        this.dasDelayCounter = this.dasDelayCounter - moveDt;
      }
      if (this.dasDelayCounter <= 0) {
        moveDt += this.dasDelayCounter;
        this.dasDelayCounter = 0;
        this.dasCounter = Math.max(0, this.dasCounter - moveDt);
        if (this.dasCounter === 0) {
          this.moveInDirection();
          this.dasCounter = DAS_LENGTH;
        }
      }
    } else {
      this.dasDelayCounter = DAS_DELAY_LENGTH;
      this.dasCounter = 0;
    }
  }

  private getIsMoving() {
    return !vectorEqual(this.direction, zeroVector);
  }

  public setDirection(direction: Vector) {
    if (!vectorEqual(this.direction, direction)) {
      this.direction = direction;

      if (!vectorEqual(this.direction, zeroVector)) {
        this.dasDelayCounter = DAS_DELAY_LENGTH;
        this.dasCounter = 0;
        this.moveInDirection();
      }
    }
  }

  private resetLocking() {
    if (this.lockResetsLeft > 0) {
      this.lockResetsLeft -= 1;
      this.lockDelayCounter = LOCK_DELAY;
    }
  }

  public hardDrop() {
    while (!this.getIsResting()) {
      this.piece.position.y += 1;
      this.pushdownLength += 1;
    }
    this.lock();
  }

  public getPiece() {
    return this.piece;
  }

  public getIsColliding() {
    return this.piece.getIsColliding();
  }
}

class Board {
  private board: Array<Cell>;

  constructor() {
    this.board = new Array(NUM_CELLS);
    for (let i = 0; i < NUM_CELLS; i += 1) {
      this.board[i] = this.getEmptyCell();
    }
  }

  private getEmptyCell(): Cell {
    return {
      filled: false,
      color: {
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
      },
    };
  }

  private getBoardIndexFromBoardPosition(boardPosition: Vector): number {
    return boardPosition.y * WIDTH + boardPosition.x;
  }

  public getCell(pos: Vector): Cell | null {
    const idx = this.getBoardIndexFromBoardPosition(pos);
    if (idx < 0 || idx > this.board.length) return null;
    return this.board[idx];
  }

  public fillCell(pos: Vector, color: PieceColor): void {
    this.board[this.getBoardIndexFromBoardPosition(pos)].filled = true;
    this.board[this.getBoardIndexFromBoardPosition(pos)].color = color;
  }

  public clearLines() {
    let linesCleared = 0;

    let y = HEIGHT - 1;
    while (y > 0) {
      let isRowComplete = true;
      for (let x = 0; x < WIDTH; x += 1) {
        if (!this.board[this.getBoardIndexFromBoardPosition({ x, y })].filled) {
          isRowComplete = false;
        }
      }

      if (isRowComplete) {
        linesCleared += 1;
        for (let y2 = y; y2 > 0; y2 -= 1) {
          for (let x = 0; x < WIDTH; x += 1) {
            this.board[this.getBoardIndexFromBoardPosition({ x, y: y2 })] =
              cellClone(
                this.board[
                  this.getBoardIndexFromBoardPosition({ x, y: y2 - 1 })
                ],
              );
          }
        }

        for (let x = 0; x < WIDTH; x += 1) {
          this.board[this.getBoardIndexFromBoardPosition({ x, y: 0 })] =
            this.getEmptyCell();
        }
      } else {
        y -= 1;
      }
    }

    return linesCleared;
  }
}

class Tetris implements GameState {
  private pc: PC;

  private board: Board;
  private boardScreenRect: Rect;

  private fallingPiece: FallingPiece | null = null;
  private nextOrigin: Vector = { x: 53, y: 4 };
  private holdOrigin: Vector = { x: 17, y: 4 };
  private heldPiece: PieceKey | null = null;
  private hasHeld: boolean = false;

  private bag: Array<PieceKey>;
  private bagIndex: number;

  private areCounter: number;

  private currentLevel: number;
  private linesCleared: number;
  private score: number;

  private isGameOver: boolean = false;
  public onQuit: Signal = new Signal();
  public onGameOver: Signal = new Signal();

  private isDownPressed: boolean = false;
  private isLeftPressed: boolean = false;
  private isRightPressed: boolean = false;

  constructor(pc: PC) {
    this.pc = pc;

    const { std } = this.pc;

    this.board = new Board();

    const screenSize = std.getConsoleSize();

    this.boardScreenRect = {
      x: Math.round((screenSize.w - WIDTH * CELL_WIDTH - BORDER_SIZE_H) / 2),
      y: screenSize.h - HEIGHT * CELL_HEIGHT - 1 * BORDER_SIZE_V,
      w: WIDTH * CELL_WIDTH,
      h: HEIGHT * CELL_HEIGHT,
    };

    this.bag = [...sevenBag];
    this.bagIndex = 0;
    this.shuffleBag();

    this.areCounter = ARE_DELAY;

    this.currentLevel = 0;
    this.linesCleared = 0;
    this.score = 0;
  }

  private shuffleBag() {
    this.bag = _.shuffle(this.bag);
    this.bagIndex = 0;
  }

  private getScreenPositionFromBoardPosition(
    boardPosition: Vector,
  ): Vector | null {
    const { std } = this.pc;
    if (!getIsVectorInRect(boardPosition, BOARD_RECT)) return null;

    const screenPos = {
      x: this.boardScreenRect.x + boardPosition.x * CELL_WIDTH,
      y: this.boardScreenRect.y + boardPosition.y * CELL_HEIGHT,
    };

    if (
      !getIsVectorInRect(
        screenPos,
        getRectFromVectorAndSize(zeroVector, std.getConsoleSize()),
      )
    )
      return null;

    return screenPos;
  }

  private drawSquare(
    screenPos: Vector,
    color: PieceColor,
    string: string = "[]",
  ) {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = color.bgColor;
    currentAttributes.fgColor = color.fgColor;
    std.setConsoleAttributes(currentAttributes);
    std.setConsoleCursorPosition(screenPos);
    std.writeConsole(string);
  }

  public drawBoardSquare(boardPosition: Vector, color: PieceColor) {
    const screenPos = this.getScreenPositionFromBoardPosition(boardPosition);
    if (screenPos) {
      this.drawSquare(screenPos, color);
    }
  }

  private drawBorder() {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);
    for (
      let y = this.boardScreenRect.y + TOP_PADDING - 2;
      y < this.boardScreenRect.y + TOP_PADDING;
      y += 1
    ) {
      std.setConsoleCursorPosition({
        x: this.boardScreenRect.x - BORDER_SIZE_H,
        y,
      });
      std.writeConsole("  " + "  ".repeat(WIDTH) + "  ", {
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
      });
    }
    for (
      let y = this.boardScreenRect.y + TOP_PADDING;
      y < this.boardScreenRect.y + HEIGHT * CELL_HEIGHT;
      y += 1
    ) {
      std.setConsoleCursorPosition({
        x: this.boardScreenRect.x - BORDER_SIZE_H,
        y,
      });
      std.updateConsoleAttributes({
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
      });
      std.writeConsole("<!", {
        bgColor: classicColors["lightGray"],
        fgColor: classicColors["black"],
      });
      std.writeConsole(" .".repeat(WIDTH), {
        bgColor: classicColors["black"],
        fgColor: classicColors["darkGray"],
      });
      std.writeConsole("!>", {
        bgColor: classicColors["lightGray"],
        fgColor: classicColors["black"],
      });
    }
    std.setConsoleCursorPosition({
      x: this.boardScreenRect.x - BORDER_SIZE_H,
      y: this.boardScreenRect.y + HEIGHT * CELL_HEIGHT,
    });
    std.writeConsole("<!" + "=".repeat(WIDTH * CELL_WIDTH) + "!>", {
      bgColor: classicColors["lightGray"],
      fgColor: classicColors["black"],
    });
  }

  private drawBoardPieces() {
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const boardPos = { x, y };
        const cell = this.board.getCell(boardPos);
        if (cell && cell.filled) {
          this.drawBoardSquare(boardPos, cell.color);
        }
      }
    }
  }

  private drawBoard() {
    this.drawBorder();
    this.drawBoardPieces();
  }

  public getBoard() {
    return this.board;
  }

  private drawStaticPiece(key: PieceKey | null, pos: Vector) {
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        this.drawSquare(
          vectorAdd(
            vectorMultiplyComponents(
              { x, y },
              {
                x: CELL_WIDTH,
                y: CELL_HEIGHT,
              },
            ),
            pos,
          ),
          {
            bgColor: classicColors["black"],
            fgColor: classicColors["darkGray"],
          },
          " .",
        );
      }
    }
    if (key) {
      const piece = new Piece(this, key);
      const color = piece.getDescriptor().color;
      piece.doForEachSquare((boardPosition, localSquarePosition) => {
        this.drawSquare(
          vectorAdd(
            vectorMultiplyComponents(
              vectorAdd(localSquarePosition, piece.getDescriptor().nextOffset),
              {
                x: CELL_WIDTH,
                y: CELL_HEIGHT,
              },
            ),
            pos,
          ),
          color,
        );
      });
    }
  }

  private drawNext() {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);
    std.setConsoleCursorPosition(this.nextOrigin);
    std.writeConsole("= NEXT =");

    this.drawStaticPiece(
      this.bag[this.bagIndex],
      vectorAdd(this.nextOrigin, { x: 0, y: 1 }),
    );
  }

  private drawHeld() {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);
    std.setConsoleCursorPosition(this.holdOrigin);
    std.writeConsole("= HOLD =");

    this.drawStaticPiece(
      this.heldPiece,
      vectorAdd(this.holdOrigin, { x: 0, y: 1 }),
    );
  }

  private drawLevel() {
    const { std } = this.pc;

    std.setConsoleCursorPosition({ x: 14, y: 20 });
    std.writeConsole("== LEVEL ==", {
      bgColor: classicColors["black"],
      fgColor: classicColors["lightGray"],
    });
    let levelString =
      this.currentLevel < levels.length - 1
        ? String(this.currentLevel)
        : `* ${this.currentLevel} *`;
    if (this.currentLevel === 69) {
      levelString = "69, nice";
    }
    std.setConsoleCursorPosition({ x: 14, y: 21 });
    std.writeConsole(` ${_.padStart(levelString, 9)} `, {
      bgColor: classicColors["darkGray"],
      fgColor: classicColors["white"],
    });
  }

  private drawLines() {
    const { std } = this.pc;

    std.setConsoleCursorPosition({ x: 14, y: 23 });
    std.writeConsole("== LINES ==", {
      bgColor: classicColors["black"],
      fgColor: classicColors["lightGray"],
    });
    std.setConsoleCursorPosition({ x: 14, y: 24 });
    std.writeConsole(` ${_.padStart(String(this.linesCleared), 9)} `, {
      bgColor: classicColors["darkGray"],
      fgColor: classicColors["white"],
    });
  }

  private drawScore() {
    const { std } = this.pc;

    std.setConsoleCursorPosition({ x: 14, y: 17 });
    std.writeConsole("== SCORE ==", {
      bgColor: classicColors["black"],
      fgColor: classicColors["lightGray"],
    });

    std.setConsoleCursorPosition({ x: 14, y: 18 });
    std.writeConsole(` ${_.padStart(String(this.score), 9)} `, {
      bgColor: classicColors["darkGray"],
      fgColor: classicColors["white"],
    });
  }

  private spawnPiece(key: PieceKey) {
    this.hasHeld = false;
    const fallingPiece = new FallingPiece(
      this,
      key,
      levels[Math.min(this.currentLevel, levels.length - 1)],
    );
    this.fallingPiece = fallingPiece;
    fallingPiece.onPlaced.listen(() => {
      this.areCounter = ARE_DELAY;
      this.fallingPiece = null;
      const linesCleared = this.board.clearLines();
      this.setLinesCleared(this.linesCleared + linesCleared);
      this.score += fallingPiece.getPushdownLength();
      this.score += this.getScoreForNumberOfLines(linesCleared);
    });
    if (fallingPiece.getIsColliding()) {
      this.isGameOver = true;
    }
  }

  private getScoreForNumberOfLines(lines: number) {
    if (lines === 1) {
      return 40 * (this.currentLevel + 1);
    } else if (lines === 2) {
      return 100 * (this.currentLevel + 1);
    } else if (lines === 3) {
      return 300 * (this.currentLevel + 1);
    } else if (lines === 4) {
      return 1200 * (this.currentLevel + 1);
    }
    return 0;
  }

  private holdPiece() {
    if (!this.hasHeld) {
      let currentFallingPiece =
        this.fallingPiece?.getPiece().getDescriptor().key ?? null;

      if (!currentFallingPiece) return;

      if (this.heldPiece) {
        let currentHeldPiece = this.heldPiece;
        this.heldPiece = currentFallingPiece;
        this.spawnPiece(currentHeldPiece);
      } else {
        this.heldPiece = currentFallingPiece;
        this.spawnPiece(this.getNextPiece());
      }
      this.hasHeld = true;
    }
  }

  private getNextPiece(): PieceKey {
    let result = this.bag[this.bagIndex];
    this.bagIndex += 1;
    if (this.bagIndex === this.bag.length) {
      this.shuffleBag();
      // reshuffle bag while it starts with the same piece as was drawn
      while (this.bag[0] === result) {
        this.shuffleBag();
      }
    }
    return result;
  }

  private setLinesCleared(linesCleared: number) {
    this.linesCleared = linesCleared;
    this.currentLevel = Math.max(
      Math.floor(linesCleared / 10),
      this.currentLevel,
    );
  }

  public onEnter() {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);
    std.clearConsole();
    std.setConsoleCursorPosition({ x: 0, y: 0 });
    std.writeConsole(
      _.pad("======== P E N G T R I S ========", std.getConsoleSize().w),
    );

    std.flushKeyboardEvents();
    this.isLeftPressed = false;
    this.isRightPressed = false;
    this.isRightPressed = false;
  }

  public onLeave() {}

  async update(dt: number) {
    const { std } = this.pc;

    std.setIsConsoleCursorVisible(false);

    // input

    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;

      if (ev.code === "ArrowDown") {
        this.isDownPressed = ev.pressed;
      }
      if (ev.code === "ArrowLeft") {
        this.isLeftPressed = ev.pressed;
      }
      if (ev.code === "ArrowRight") {
        this.isRightPressed = ev.pressed;
      }

      if (ev.isModifier || !ev.pressed || ev.isAutoRepeat) continue;

      if (ev.code === "ArrowUp") {
        this.fallingPiece?.rotateRight();
      }
      if (ev.code === "KeyZ") {
        this.fallingPiece?.rotateLeft();
      }
      if (ev.code === "KeyX") {
        this.fallingPiece?.rotateRight();
      }
      if (ev.code === "KeyC") {
        this.holdPiece();
      }
      if (ev.code === "Space") {
        this.fallingPiece?.hardDrop();
      }
      if (ev.code === "Escape") {
        this.onQuit.emit();
        return;
      }
    }

    if (this.fallingPiece) {
      this.fallingPiece.setIsPushdown(this.isDownPressed);
      if (this.isLeftPressed) {
        this.fallingPiece.setDirection({ x: -1, y: 0 });
      } else if (this.isRightPressed) {
        this.fallingPiece.setDirection({ x: 1, y: 0 });
      } else if (!this.isLeftPressed && !this.isRightPressed) {
        this.fallingPiece.setDirection({ x: 0, y: 0 });
      }
    }

    // logic

    if (this.fallingPiece) {
      this.fallingPiece.update(dt);
    } else {
      this.areCounter -= dt;
      if (this.areCounter <= 0) {
        this.spawnPiece(this.getNextPiece());
      }
    }

    // rendering

    this.drawBoard();
    this.fallingPiece?.draw();
    this.drawNext();
    this.drawHeld();
    this.drawLevel();
    this.drawLines();
    this.drawScore();

    if (this.isGameOver) {
      this.onGameOver.emit();
      return;
    }
  }
}

class MainMenu implements GameState {
  private pc: PC;

  public onStartGame: Signal;
  public onQuit: Signal;

  private titleGraphic: [string, string];

  constructor(pc: PC) {
    this.pc = pc;
    this.onStartGame = new Signal();
    this.onQuit = new Signal();

    this.titleGraphic = [
      "     b     o yy  gg  p  rr ",
      "cccc bbb ooo yy gg  ppp  rr",
    ];
  }

  onEnter() {
    const { std } = this.pc;

    let currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);
    std.clearConsole();

    let start = 6;
    for (let titleLineIndex = 0; titleLineIndex < 2; titleLineIndex += 1) {
      std.setConsoleCursorPosition({ x: 12, y: start + titleLineIndex });
      for (const char of this.titleGraphic[titleLineIndex]) {
        switch (char) {
          case " ":
            std.writeConsole("  ", {
              fgColor: classicColors["black"],
            });
            break;
          case "c":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.I].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.I].color.fgColor,
            });
            break;
          case "b":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.J].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.J].color.fgColor,
            });
            break;
          case "o":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.L].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.L].color.fgColor,
            });
            break;
          case "y":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.O].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.O].color.fgColor,
            });
            break;
          case "g":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.S].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.S].color.fgColor,
            });
            break;
          case "p":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.T].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.T].color.fgColor,
            });
            break;
          case "r":
            std.writeConsole("[]", {
              bgColor: pieceDescriptors[PieceKey.Z].color.bgColor,
              fgColor: pieceDescriptors[PieceKey.Z].color.fgColor,
            });
            break;
        }
        std.resetConsoleAttributes();
      }
    }

    currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["black"];
    currentAttributes.fgColor = classicColors["lightGray"];
    std.setConsoleAttributes(currentAttributes);

    std.setConsoleCursorPosition({ x: 0, y: start + 3 });
    std.writeConsole(
      _.pad("======== P E N G T R I S ========", std.getConsoleSize().w),
    );

    std.setConsoleCursorPosition({ x: 0, y: start + 5 });
    std.writeConsole(
      _.pad("Press ENTER to begin game", std.getConsoleSize().w),
    );

    std.setConsoleCursorPosition({ x: 0, y: start + 6 });
    std.writeConsole(_.pad("Press ESCAPE to quit", std.getConsoleSize().w));

    std.setConsoleCursorPosition({ x: 0, y: start + 8 });
    std.writeConsole(_.pad("== Controls ==", std.getConsoleSize().w));

    std.setConsoleCursorPosition({ x: 0, y: start + 9 });
    std.writeConsole(
      _.pad("[left] and [right] - move piece", std.getConsoleSize().w),
    );

    std.setConsoleCursorPosition({ x: 0, y: start + 10 });
    std.writeConsole(
      _.pad(
        "[z] - rotate left, [x] - rotate right, [c] - swap",
        std.getConsoleSize().w,
      ),
    );

    std.setConsoleCursorPosition({
      x: Math.floor(
        (std.getConsoleSize().w - "Programming: Strawberry".length) / 2,
      ),
      y: start + 12,
    });
    std.writeConsole("Programming: ");
    std.writeConsole("Strawberry", { fgColor: classicColors["lightRed"] });

    std.setConsoleCursorPosition({
      x: Math.floor(
        (std.getConsoleSize().w - "Original game: Alexey Pajitnov".length) / 2,
      ),
      y: start + 13,
    });
    std.writeConsole("Original game: ", { reset: true });
    std.writeConsole("Alexey Pajitnov", {
      fgColor: classicColors["lightAzure"],
    });
    std.resetConsoleAttributes();
  }

  update(dt: number) {
    const { std } = this.pc;

    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;
      if (ev.isModifier || !ev.pressed) continue;

      if (ev.code === "Enter") {
        this.onStartGame.emit();
      } else if (ev.code === "Escape") {
        this.onQuit.emit();
      }
    }
  }

  onLeave() {}
}

class GameOver implements GameState {
  private pc: PC;

  public onContinue: Signal;

  constructor(pc: PC) {
    this.pc = pc;
    this.onContinue = new Signal();
  }

  onEnter() {
    const { std } = this.pc;

    const currentAttributes = std.getConsoleAttributes();
    currentAttributes.bgColor = classicColors["lightGray"];
    currentAttributes.fgColor = classicColors["black"];
    std.setConsoleAttributes(currentAttributes);
    std.setConsoleCursorPosition({ x: 27, y: 13 });
    std.writeConsole("  ==   GAME  OVER   ==  ");
    std.setConsoleCursorPosition({ x: 27, y: 14 });
    std.writeConsole("  ==  Press ESCAPE  ==  ");
  }

  update() {
    const { std } = this.pc;

    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;
      if (ev.isModifier || !ev.pressed) continue;

      if (ev.code === "Escape") {
        this.onContinue.emit();
      }
    }
  }

  onLeave() {}
}

enum GameStateKey {
  MainMenu,
  Tetris,
  GameOver,
}

export class TetrisApp implements Executable {
  private pc: PC;

  private currentState: GameState | null = null;
  private isQuitting: boolean = false;

  private changeState(newStateKey: GameStateKey) {
    const { std } = this.pc;
    std.flushKeyboardEvents();
    this.currentState?.onLeave();
    switch (newStateKey) {
      case GameStateKey.MainMenu:
        const mainMenu = new MainMenu(this.pc);
        mainMenu.onStartGame.listen(() => {
          this.changeState(GameStateKey.Tetris);
        });
        mainMenu.onQuit.listen(() => {
          this.isQuitting = true;
        });
        this.currentState = mainMenu;
        break;
      case GameStateKey.Tetris:
        const tetris = new Tetris(this.pc);
        tetris.onQuit.listen(() => {
          this.changeState(GameStateKey.MainMenu);
        });
        tetris.onGameOver.listen(() => {
          this.changeState(GameStateKey.GameOver);
        });
        this.currentState = tetris;
        break;
      case GameStateKey.GameOver:
        const gameOver = new GameOver(this.pc);
        gameOver.onContinue.listen(() => {
          this.changeState(GameStateKey.MainMenu);
        });
        this.currentState = gameOver;
        break;
    }
    this.currentState?.onEnter();
  }

  constructor(pc: PC) {
    this.pc = pc;
  }

  async run(args: string[]) {
    const { std } = this.pc;

    std.flushKeyboardEvents();
    this.changeState(GameStateKey.MainMenu);

    return new Promise<void>((resolve) => {
      std.setIsConsoleCursorVisible(false);

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
