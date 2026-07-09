/* Port of Games/Snake. */

import { type DeviceEvent, v, vAdd, vEq, type Vec } from "./core";
import { TickTimer } from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { CurtainState, ExplodeState, ExplodeStep } from "./common";

enum SnakeDir {
    Up,
    Down,
    Left,
    Right,
}

const SNAKE_DIR_VECTORS: Record<SnakeDir, Vec> = {
    [SnakeDir.Up]: v(0, -1),
    [SnakeDir.Down]: v(0, 1),
    [SnakeDir.Left]: v(-1, 0),
    [SnakeDir.Right]: v(1, 0),
};

/** Port of Games/Snake/Snake.gd. */
export class Snake extends GameState {
    private direction = SnakeDir.Right;
    private directionChanged = false;
    private sections: Vec[] = [];
    private fieldSize = v(0, 0);
    private snakeTimer = new TickTimer(10);
    private blinkTimer = new TickTimer(5);
    public blinkOn = true;
    private foodPosition: Vec | null = null;
    private score = 0;
    public lives = 3;

    constructor(root: GameRoot) {
        super(root);
        this.snakeTimer.onTriggered = () => this.stepSnake();
        this.blinkTimer.onTriggered = () => {
            this.blinkOn = !this.blinkOn;
        };
    }

    public generateFood() {
        let overlaps = true;
        while (overlaps) {
            this.foodPosition = v(
                Math.floor(Math.random() * this.fieldSize.x),
                Math.floor(Math.random() * this.fieldSize.y),
            );
            overlaps = false;
            for (const section of this.sections) {
                if (vEq(this.foodPosition, section)) overlaps = true;
            }
        }
    }

    private stepSnake() {
        this.directionChanged = false;
        const newHead = vAdd(
            this.sections[this.sections.length - 1],
            SNAKE_DIR_VECTORS[this.direction],
        );

        if (!this.foodPosition || !vEq(newHead, this.foodPosition)) {
            this.sections.shift();
        }

        if (newHead.x >= this.fieldSize.x) newHead.x = 0;
        if (newHead.y >= this.fieldSize.y) newHead.y = 0;
        if (newHead.x < 0) newHead.x = this.fieldSize.x - 1;
        if (newHead.y < 0) newHead.y = this.fieldSize.y - 1;
        this.sections.push(newHead);

        this.checkCollisions();
    }

    private checkCollisions() {
        const head = this.sections[this.sections.length - 1];

        if (this.foodPosition && vEq(head, this.foodPosition)) {
            this.score += 1;
            this.generateFood();
        }

        for (let i = 0; i < this.sections.length - 1; i += 1) {
            if (vEq(head, this.sections[i])) {
                this.explodeSnake();
            }
        }
    }

    private turnSnake(dir: "up" | "down" | "left" | "right") {
        if (this.directionChanged) return;
        switch (dir) {
            case "down":
                if (this.direction !== SnakeDir.Up) {
                    this.direction = SnakeDir.Down;
                    this.directionChanged = true;
                }
                break;
            case "up":
                if (this.direction !== SnakeDir.Down) {
                    this.direction = SnakeDir.Up;
                    this.directionChanged = true;
                }
                break;
            case "left":
                if (this.direction !== SnakeDir.Right) {
                    this.direction = SnakeDir.Left;
                    this.directionChanged = true;
                }
                break;
            case "right":
                if (this.direction !== SnakeDir.Left) {
                    this.direction = SnakeDir.Right;
                    this.directionChanged = true;
                }
                break;
        }
    }

    public setSnakeSpeed(speed: "fast" | "normal") {
        this.snakeTimer.setLength(speed === "fast" ? 3 : 10);
    }

    private explodeSnake() {
        this.lives -= 1;
        this.root.replaceState(new SnakeExplode(this.root, this));
    }

    public resetSnake() {
        this.sections = [v(0, 0), v(1, 0), v(2, 0)];
        this.setSnakeSpeed("normal");
        this.direction = SnakeDir.Right;
        this.directionChanged = false;
    }

    override bgEnter() {
        this.fieldSize = this.device.mainScreen.arraySize;
        this.root.pushState(new SnakeStart(this.root, this));
    }

    override bgFocus() {
        this.root.popState();
    }

    public inputSnake(event: DeviceEvent) {
        if (event.type !== "key") return;
        if (event.pressed) {
            switch (event.key) {
                case "down":
                    this.turnSnake("down");
                    break;
                case "up":
                    this.turnSnake("up");
                    break;
                case "left":
                    this.turnSnake("left");
                    break;
                case "right":
                    this.turnSnake("right");
                    break;
                case "fire":
                    this.setSnakeSpeed("fast");
                    break;
                case "exit":
                    this.root.popState();
                    break;
            }
        } else {
            if (event.key === "fire") {
                this.setSnakeSpeed("normal");
            }
        }
    }

    public tickBlink() {
        this.blinkTimer.tick();
    }

    public tickSnake() {
        this.snakeTimer.tick();
    }

    public renderScore() {
        this.device.scoreDisplay.setNumber(this.score);
    }

    public renderField() {
        const mainScreen = this.device.mainScreen;
        mainScreen.clear();
        for (const section of this.sections) {
            mainScreen.setPixel(section.x, section.y, true);
        }
        if (this.foodPosition) {
            mainScreen.setPixel(
                this.foodPosition.x,
                this.foodPosition.y,
                this.blinkOn,
            );
        }
    }

    public renderLives() {
        const hintScreen = this.device.hintScreen;
        hintScreen.clear();
        hintScreen.setCount(this.lives);
    }

    public getHead(): Vec {
        return this.sections[this.sections.length - 1];
    }
}

/** Port of Games/Snake/SnakeStart.gd. */
class SnakeStart extends GameState {
    private startTimer = new TickTimer(60);
    private snake: Snake;

    constructor(root: GameRoot, snake: Snake) {
        super(root);
        this.snake = snake;
    }

    override bgEnter() {
        this.snake.resetSnake();
        this.snake.generateFood();
        if (this.snake.lives <= 0) {
            this.root.popState();
        }
    }

    override bgTick() {
        this.snake.tickBlink();
        this.startTimer.tick();
        if (this.startTimer.isTriggered) {
            this.root.replaceState(new SnakePlay(this.root, this.snake));
        }
    }

    override bgRender() {
        this.snake.renderScore();
        this.snake.renderField();
        this.snake.renderLives();
    }
}

/** Port of Games/Snake/SnakePlay.gd. */
class SnakePlay extends GameState {
    private snake: Snake;

    constructor(root: GameRoot, snake: Snake) {
        super(root);
        this.snake = snake;
    }

    override bgRender() {
        this.snake.renderScore();
        this.snake.renderField();
        this.snake.renderLives();
    }

    override bgTick() {
        this.snake.tickSnake();
        this.snake.tickBlink();
    }

    override bgInput(event: DeviceEvent) {
        this.snake.inputSnake(event);
    }

    override bgEnter() {
        if (this.root.isKeyDown("fire")) {
            this.snake.setSnakeSpeed("fast");
        }
    }

    override bgLeave() {
        this.snake.blinkOn = true;
        this.snake.renderField();
    }
}

/** Port of Games/Snake/SnakeExplode.gd. */
class SnakeExplode extends GameState {
    private snake: Snake;
    private step = ExplodeStep.Explode;

    constructor(root: GameRoot, snake: Snake) {
        super(root);
        this.snake = snake;
    }

    override bgEnter() {
        const explode = new ExplodeState(this.root);
        const head = this.snake.getHead();
        explode.setLocation(v(head.x - 1, head.y - 1));
        this.root.pushState(explode);
    }

    override bgFocus() {
        this.step += 1;
        switch (this.step) {
            case ExplodeStep.Curtain:
                if (this.snake.lives === 0) {
                    this.root.pushState(new CurtainState(this.root));
                } else {
                    this.bgFocus();
                }
                break;
            case ExplodeStep.End:
                this.root.replaceState(new SnakeStart(this.root, this.snake));
                break;
        }
    }
}
