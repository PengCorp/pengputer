import { Executable } from "./FileSystem";
import { Signal } from "../Toolbox/Signal";
import { State, StateManager } from "../Toolbox/StateManager";
import { PC } from "./PC";
import { Graphics } from "../Screen/Graphics";
import { Std } from "../Std";
import { makeSprite } from "../Screen/Graphics.Sprite";
import { Vector } from "../Toolbox/Vector";
import { KeyCode } from "../Keyboard/types.keyCode";
import _ from "lodash";

const LAYER_BG = 0;
const LAYER_SPRITES = 1;

/* cSpell:disable */

const ball = makeSprite(
  [
    "  ░░░░  ",
    " ░▒▒▒▒░ ",
    "░▒▒▒▒▒▒░",
    "░▒▒▒▒▒▒░",
    "░▒▒▒▒▒▒░",
    "░▒▒▒▒▒▒░",
    " ░▒▒▒▒░ ",
    "  ░░░░  ",
  ],
  {
    " ": -1,
    "░": 27,
    "▒": 17,
    "▓": 3,
  },
);

const paddleLeft = makeSprite(
  [
    " ░░░░░░░",
    "░▒░▒▒▒▒▒",
    "░▒░▒▓▓▓▓",
    "░▒░▒▓▓▓▓",
    "░▒░▒▓▓▓▓",
    "░▒░▒▓▓▓▓",
    "░▒░▒▒▒▒▒",
    " ░░░░░░░",
  ],
  {
    " ": -1,
    "░": 27,
    "▒": 17,
    "▓": 3,
  },
);

const paddleRight = makeSprite(
  [
    "░░░░░░░ ",
    "▒▒▒▒▒░▒░",
    "▓▓▓▓▒░▒░",
    "▓▓▓▓▒░▒░",
    "▓▓▓▓▒░▒░",
    "▓▓▓▓▒░▒░",
    "▒▒▒▒▒░▒░",
    "░░░░░░░ ",
  ],
  {
    " ": -1,
    "░": 27,
    "▒": 17,
    "▓": 3,
  },
);

const paddleCenter = makeSprite(
  [
    "░░░░░░░░",
    "▒▒▒▒▒▒▒▒",
    "▓▓▓▓▓▓▓▓",
    "▓▓▓░░▓▓▓",
    "▓▓▓░░▓▓▓",
    "▓▓▓▓▓▓▓▓",
    "▒▒▒▒▒▒▒▒",
    "░░░░░░░░",
  ],
  {
    " ": -1,
    "░": 27,
    "▒": 17,
    "▓": 3,
  },
);

/* cSpell:enable */

enum GameStateKey {
  MainMenu,
  Game,
}

const PADDLE_SEGMENT_WIDTH = 8;

class Game extends State {
  private pc: PC;
  private std: Std;
  private graphics: Graphics;

  public signal: Signal<void> = new Signal();

  private ballPosition: Vector = { x: 0, y: 0 };

  private ballCounterLength = (1000 / 60) * 10;
  private ballCounter = 0;

  private paddlePosition: Vector = { x: 0, y: 240 - 16 };

  private paddleCounterLength = (1000 / 60) * 0.5;
  private paddleCounter = 0;

  private paddleWidthSegments: number = 5;

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
          this.paddleCounter = this.paddleCounterLength;
        } else if (ev.code === "ArrowRight") {
          this.pressedDirections.push("ArrowRight");
          this.paddleCounter = this.paddleCounterLength;
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
  }

  private updatePaddle() {
    if (this.pressedDirections.length > 0) {
      const dir = this.pressedDirections[this.pressedDirections.length - 1];

      if (dir === "ArrowLeft") {
        this.paddlePosition.x -= 1;
      } else if (dir === "ArrowRight") {
        this.paddlePosition.x += 1;
      }
    }
  }

  private updateBall() {
    this.ballPosition.x += 1;
    this.ballPosition.y += 1;
  }

  private logic(dt: number) {
    this.ballCounter += dt;
    while (this.ballCounter >= this.ballCounterLength) {
      this.ballCounter -= this.ballCounterLength;

      this.updateBall();
    }

    this.paddleCounter += dt;
    while (this.paddleCounter >= this.paddleCounterLength) {
      this.paddleCounter -= this.paddleCounterLength;

      this.updatePaddle();
    }
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

    graphics.drawSprite(ball, this.ballPosition.x, this.ballPosition.y);
  }

  private drawPaddle() {
    const { graphics } = this;

    let width = 0;

    this.graphics.drawSprite(
      paddleLeft,
      this.paddlePosition.x + PADDLE_SEGMENT_WIDTH * 0,
      this.paddlePosition.y,
    );
    width += 1;

    while (width < this.paddleWidthSegments - 1) {
      this.graphics.drawSprite(
        paddleCenter,
        this.paddlePosition.x + PADDLE_SEGMENT_WIDTH * width,
        this.paddlePosition.y,
      );
      width += 1;
    }

    this.graphics.drawSprite(
      paddleRight,
      this.paddlePosition.x + PADDLE_SEGMENT_WIDTH * width,
      this.paddlePosition.y,
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
