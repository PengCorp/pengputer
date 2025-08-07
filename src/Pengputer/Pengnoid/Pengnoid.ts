import { Executable } from "../FileSystem";
import { Signal } from "../../Toolbox/Signal";
import { State, StateManager } from "../../Toolbox/StateManager";
import { PC } from "../PC";
import { Graphics } from "../../Screen/Graphics";
import { Std } from "../../Std";
import { makeSprite } from "../../Screen/Graphics.Sprite";
import {
  getDoRectsOverlap,
  getRectWithPosition,
  Vector,
  vectorDivideByNumberFloored,
} from "../../Toolbox/Vector";
import { KeyCode } from "../../Keyboard/types.keyCode";
import _ from "lodash";
import { sprites } from "./sprites";
import { Rect } from "../../types";

const LAYER_BG = 0;
const LAYER_SPRITES = 1;

enum GameStateKey {
  MainMenu,
  Game,
}

class Ball {
  public position: Vector = { x: 0, y: 0 };
  public direction: Vector = {
    x: Math.sin(Math.PI / 4),
    y: Math.cos(Math.PI / 4),
  };

  public tickCounterLength = 5;
  public tickCounter = 0;

  constructor() {}

  tick() {
    this.position = {
      x: this.position.x + this.direction.x,
      y: this.position.y + this.direction.y,
    };
  }

  undoTick() {
    this.position = {
      x: this.position.x - this.direction.x,
      y: this.position.y - this.direction.y,
    };
  }

  update(dt: number) {
    this.tickCounter += dt;
    while (this.tickCounter >= this.tickCounterLength) {
      this.tickCounter -= this.tickCounterLength;

      this.tick();
    }
  }

  getRect() {
    return {
      x: Math.floor(this.position.x),
      y: Math.floor(this.position.y),
      w: 8,
      h: 8,
    };
  }
}

type PaddleDirection = "left" | "right" | null;

const PADDLE_SEGMENT_SIZE_IN_PIXELS = 8;

class Paddle {
  public position: Vector = { x: 0, y: 240 - 16 };

  public tickCounterLength = 5;
  public tickCounter = 0;

  public widthInSegments: number = 5;

  private direction: PaddleDirection = null;

  constructor() {}

  setDirection(direction: PaddleDirection) {
    if (direction !== this.direction) {
      this.direction = direction;
      this.tickCounter = this.tickCounterLength;
    }
  }

  tick() {
    switch (this.direction) {
      case "left":
        this.position.x -= 1;
        break;
      case "right":
        this.position.x += 1;
        break;
    }
  }

  update(dt: number) {
    this.tickCounter += dt;
    while (this.tickCounter >= this.tickCounterLength) {
      this.tickCounter -= this.tickCounterLength;

      this.tick();
    }
  }

  getRect(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      w: this.widthInSegments * PADDLE_SEGMENT_SIZE_IN_PIXELS,
      h: PADDLE_SEGMENT_SIZE_IN_PIXELS,
    };
  }
}

class Game extends State {
  private pc: PC;
  private std: Std;
  private graphics: Graphics;

  public signal: Signal<void> = new Signal();

  private ball: Ball = new Ball();

  private paddle: Paddle = new Paddle();

  private pressedDirections: KeyCode[] = [];

  private screenRect: Rect;

  private tickCounter: number = 0;
  private tickLength: number = 0.1;

  constructor(pc: PC) {
    super();

    this.pc = pc;
    this.std = pc.std;
    this.graphics = this.std.getGraphics();

    const graphicsSize = this.graphics.getSize();
    this.screenRect = { x: 0, y: 0, w: graphicsSize.w, h: graphicsSize.h };
  }

  override onEnter(): void {
    super.onEnter();

    const { std } = this;
    std.flushKeyboardEvents();
  }

  private doEvents(dt: number) {
    const { std } = this;
    while (true) {
      const ev = std.getNextKeyboardEvent();
      if (!ev) break;

      if (ev.isAutoRepeat) continue;

      if (ev.pressed) {
        if (ev.code === "ArrowLeft") {
          this.pressedDirections.push("ArrowLeft");
        } else if (ev.code === "ArrowRight") {
          this.pressedDirections.push("ArrowRight");
        }
      } else {
        if (ev.code === "ArrowLeft") {
          this.pressedDirections = this.pressedDirections.filter(
            (kc) => kc !== "ArrowLeft",
          );
        } else if (ev.code === "ArrowRight") {
          this.pressedDirections = this.pressedDirections.filter(
            (kc) => kc !== "ArrowRight",
          );
        }
      }

      this.pressedDirections = _.uniq(this.pressedDirections);
    }

    const dir =
      this.pressedDirections.length > 0
        ? this.pressedDirections[this.pressedDirections.length - 1]
        : null;

    if (dir === "ArrowLeft") {
      this.paddle.setDirection("left");
    } else if (dir === "ArrowRight") {
      this.paddle.setDirection("right");
    } else {
      this.paddle.setDirection(null);
    }
  }

  private doLogic(dt: number) {
    this.tickCounter += dt;

    while (this.tickCounter >= this.tickLength) {
      this.paddle.update(this.tickLength);
      this.ball.update(this.tickLength);

      this.tickCounter -= this.tickLength;
    }

    if (getDoRectsOverlap(this.paddle.getRect(), this.ball.getRect())) {
      console.log("rect");
    }
  }

  override update(dt: number): void {
    this.doEvents(dt);
    this.doLogic(dt);
    this.doGraphics(dt);
  }

  doGraphics(dt: number) {
    const { graphics } = this;

    const graphicsSize = graphics.getSize();

    graphics.setLayer(LAYER_SPRITES);
    graphics.clearRect(0, 0, graphicsSize.w, graphicsSize.h);

    this.drawBall();
    this.drawPaddle();
  }

  private drawBall() {
    const { graphics } = this;

    const ballRect = this.ball.getRect();

    graphics.drawSprite(sprites.ball, ballRect.x, ballRect.y);
  }

  private drawPaddle() {
    const { graphics } = this;

    const drawPos = this.paddle.position;

    let drawnWidth = 0;

    graphics.drawSprite(
      sprites.paddleLeft,
      drawPos.x + PADDLE_SEGMENT_SIZE_IN_PIXELS * 0,
      drawPos.y,
    );
    drawnWidth += 1;

    while (drawnWidth < this.paddle.widthInSegments - 1) {
      graphics.drawSprite(
        sprites.paddleCenter,
        drawPos.x + PADDLE_SEGMENT_SIZE_IN_PIXELS * drawnWidth,
        drawPos.y,
      );
      drawnWidth += 1;
    }

    graphics.drawSprite(
      sprites.paddleRight,
      drawPos.x + PADDLE_SEGMENT_SIZE_IN_PIXELS * drawnWidth,
      drawPos.y,
    );
  }
}

export class Pengnoid implements Executable {
  private pc: PC;
  private std: Std;
  private graphics: Graphics;

  private stateManager: StateManager = new StateManager();

  constructor(pc: PC) {
    this.pc = pc;
    this.std = pc.std;
    this.graphics = this.std.getGraphics();

    this.std.setAreGraphicsEnabled(true);
    this.graphics.reset();
    this.graphics.addLayer();

    this.std.flushKeyboardEvents();
  }

  private changeState(newStateKey: GameStateKey, shouldPush: boolean = false) {
    let newState = null;

    switch (newStateKey) {
      case GameStateKey.Game:
        newState = new Game(this.pc);
        newState.signal.listen((s) => {});
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
    const { std } = this;

    std.flushKeyboardEvents();

    this.changeState(GameStateKey.Game);

    return new Promise<void>((resolve) => {
      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        const start = performance.now();
        this.stateManager.update(dt);
        const end = performance.now();
        window.updateTime = end - start;

        if (this.stateManager.getIsEmpty()) {
          std.setAreGraphicsEnabled(false);
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
