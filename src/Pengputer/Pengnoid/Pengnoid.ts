import { type Executable } from "@FileSystem/fileTypes";
import { Signal } from "@Toolbox/Signal";
import { State, StateManager } from "@Toolbox/StateManager";
import { type PC } from "../PC";
import { Graphics } from "../../Screen/Graphics";
import { Std } from "../../Std";
import { makeSprite } from "../../Screen/Graphics.Sprite";
import { type Vector } from "@Toolbox/Vector";
import { type KeyCode } from "../../Keyboard/types.keyCode";
import _ from "lodash";
import { sprites } from "./sprites";

const LAYER_BG = 0;
const LAYER_SPRITES = 1;

enum GameStateKey {
  MainMenu,
  Game,
}

class Ball {
  public ballPosition: Vector = { x: 0, y: 0 };

  public ballCounterLength = 1000 / 60;
  public ballCounter = 0;

  constructor() {}

  tick() {
    this.ballPosition.x += 1;
    this.ballPosition.y += 1;
  }

  update(dt: number) {
    this.ballCounter += dt;
    while (this.ballCounter >= this.ballCounterLength) {
      this.ballCounter -= this.ballCounterLength;

      this.tick();
    }
  }
}

type PaddleDirection = "left" | "right" | null;

class Paddle {
  public paddlePosition: Vector = { x: 0, y: 240 - 16 };

  public paddleCounterLength = (1000 / 60) * 0.5;
  public paddleCounter = 0;

  public paddleWidthSegments: number = 5;

  private direction: PaddleDirection = null;

  constructor() {}

  setDirection(direction: PaddleDirection) {
    if (direction !== this.direction) {
      this.direction = direction;
      this.paddleCounter = this.paddleCounterLength;
    }
  }

  tick() {
    switch (this.direction) {
      case "left":
        this.paddlePosition.x -= 1;
        break;
      case "right":
        this.paddlePosition.x += 1;
        break;
    }
  }

  update(dt: number) {
    this.paddleCounter += dt;
    while (this.paddleCounter >= this.paddleCounterLength) {
      this.paddleCounter -= this.paddleCounterLength;

      this.tick();
    }
  }
}

const PADDLE_SEGMENT_WIDTH = 8;

class Game extends State {
  private pc: PC;
  private std: Std;
  private graphics: Graphics;

  public signal: Signal<void> = new Signal();

  private ball: Ball = new Ball();

  private paddle: Paddle = new Paddle();

  private pressedDirections: KeyCode[] = [];

  constructor(pc: PC) {
    super();

    this.pc = pc;
    this.std = pc.std;
    this.graphics = this.std.getGraphics();
  }

  override onEnter(): void {
    super.onEnter();

    const { std } = this;
    std.flushKeyboardEvents();
  }

  private events(dt: number) {
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

  private logic(dt: number) {
    this.paddle.update(dt);
    this.ball.update(dt);
  }

  override update(dt: number): void {
    const { graphics } = this;

    this.events(dt);

    this.logic(dt);

    const graphicsSize = graphics.getSize();

    graphics.setLayer(LAYER_SPRITES);
    graphics.clearRect(0, 0, graphicsSize.w, graphicsSize.h);

    this.drawBall();
    this.drawPaddle();
  }

  private drawBall() {
    const { graphics } = this;

    graphics.drawSprite(
      sprites.ball,
      this.ball.ballPosition.x,
      this.ball.ballPosition.y,
    );
  }

  private drawPaddle() {
    const { graphics } = this;

    let width = 0;

    graphics.drawSprite(
      sprites.paddleLeft,
      this.paddle.paddlePosition.x + PADDLE_SEGMENT_WIDTH * 0,
      this.paddle.paddlePosition.y,
    );
    width += 1;

    while (width < this.paddle.paddleWidthSegments - 1) {
      graphics.drawSprite(
        sprites.paddleCenter,
        this.paddle.paddlePosition.x + PADDLE_SEGMENT_WIDTH * width,
        this.paddle.paddlePosition.y,
      );
      width += 1;
    }

    graphics.drawSprite(
      sprites.paddleRight,
      this.paddle.paddlePosition.x + PADDLE_SEGMENT_WIDTH * width,
      this.paddle.paddlePosition.y,
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

        this.stateManager.update(dt);

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
