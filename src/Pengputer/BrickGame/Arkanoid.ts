/* Port of Games/Arkanoid. */

import {
    clamp,
    type DeviceEvent,
    rectHasPoint,
    TickTimer,
    v,
    vAdd,
    type Vec,
} from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { type Device } from "./Device";

const ARK_WIDTH = 10;
const ARK_HEIGHT = 20;

// prettier-ignore
const ARK_LEVEL_A =
    "          " + "          " + " ******** " + "  ******  " +
    "  ******  " + " ******** " + "          " + "          " +
    "          " + "          " + "          " + "          " +
    "          " + "          " + "          " + "          " +
    "          " + "          " + "          " + "          ";

/** Port of Games/Arkanoid/ArkanoidLevel.gd. */
class ArkanoidLevel {
    private bricks: boolean[] = [];

    constructor() {
        for (let x = 0; x < ARK_WIDTH; x += 1) {
            for (let y = 0; y < ARK_HEIGHT; y += 1) {
                this.bricks.push(false);
            }
        }
        this.setFromString(ARK_LEVEL_A);
    }

    private setFromString(levelString: string) {
        for (let x = 0; x < ARK_WIDTH; x += 1) {
            for (let y = 0; y < ARK_HEIGHT; y += 1) {
                this.bricks[y * ARK_WIDTH + x] =
                    levelString[y * ARK_WIDTH + x] === "*";
            }
        }
    }

    public removeAt(position: Vec) {
        this.bricks[position.y * ARK_WIDTH + position.x] = false;
    }

    public isBrickAt(position: Vec): boolean {
        if (
            position.x < 0 ||
            position.x >= ARK_WIDTH ||
            position.y < 0 ||
            position.y >= ARK_HEIGHT
        ) {
            return false;
        }
        return this.bricks[position.y * ARK_WIDTH + position.x];
    }

    public render(device: Device) {
        const screen = device.mainScreen;
        for (let x = 0; x < ARK_WIDTH; x += 1) {
            for (let y = 0; y < ARK_HEIGHT; y += 1) {
                if (this.bricks[y * ARK_WIDTH + x]) {
                    screen.setPixel(x, y, true);
                }
            }
        }
    }
}

/** Port of Games/Arkanoid/ArkanoidBall.gd. */
class ArkanoidBall {
    private arkanoid: Arkanoid;
    private timer = new TickTimer(0);
    public position = v(5, 18);
    public direction = v(1, -1);
    private _speed = 0;

    constructor(arkanoid: Arkanoid) {
        this.arkanoid = arkanoid;
        this.timer.onTriggered = () => this.step();
        this.reset();
    }

    public get speed(): number {
        return this._speed;
    }

    public set speed(value: number) {
        this._speed = value;
        this.timer.setLength(10 - value);
    }

    public reset() {
        this.position = v(5, 18);
        this.direction = v(1, -1);
        this.speed = -10;
    }

    public render(device: Device) {
        device.mainScreen.setPixel(this.position.x, this.position.y, true);
    }

    private step() {
        this.checkBounces();
        this.move(vAdd(this.position, this.direction));
    }

    public tick() {
        this.timer.tick();
    }

    public move(newPosition: Vec) {
        this.position = newPosition;
        this.position.x = clamp(this.position.x, 0, 9);
        this.position.y = clamp(this.position.y, 0, 19);
    }

    private checkBounces() {
        const level = this.arkanoid.level;

        // Safety cap to avoid a freeze in degenerate corner cases.
        let guard = 0;
        while (guard < 64) {
            guard += 1;
            const newPosition = vAdd(this.position, this.direction);

            if (newPosition.x < 0 || newPosition.x > 9) {
                this.direction.x = -this.direction.x;
                continue;
            }
            if (newPosition.y < 0 || newPosition.y > 19) {
                this.direction.y = -this.direction.y;
                continue;
            }

            const paddle = this.arkanoid.paddle;
            const paddleRectPos = paddle.rectPos();
            const paddleRectSize = paddle.rectSize();
            const paddleFacePos = paddle.faceRectPos();
            const paddleFaceSize = paddle.rectSize();

            // direction pointing opposite to paddle facing (0,-1) => moving down
            if (
                this.direction.x * paddle.facing.x +
                    this.direction.y * paddle.facing.y <
                0
            ) {
                if (
                    rectHasPoint(paddleFacePos, paddleFaceSize, this.position)
                ) {
                    this.direction.y = -this.direction.y;
                    continue;
                } else if (
                    rectHasPoint(paddleRectPos, paddleRectSize, newPosition)
                ) {
                    this.direction.y = -this.direction.y;
                    this.direction.x = -this.direction.x;
                    continue;
                }
            }

            if (
                this.arkanoid.level.isBrickAt(
                    v(this.position.x, this.position.y + this.direction.y),
                )
            ) {
                level.removeAt(
                    v(this.position.x, this.position.y + this.direction.y),
                );
                this.direction.y = -this.direction.y;
                continue;
            }
            if (
                this.arkanoid.level.isBrickAt(
                    v(this.position.x + this.direction.x, this.position.y),
                )
            ) {
                level.removeAt(
                    v(this.position.x + this.direction.x, this.position.y),
                );
                this.direction.x = -this.direction.x;
                continue;
            }
            if (
                this.arkanoid.level.isBrickAt(
                    vAdd(this.position, this.direction),
                )
            ) {
                level.removeAt(vAdd(this.position, this.direction));
                this.direction.x = -this.direction.x;
                this.direction.y = -this.direction.y;
                continue;
            }
            break;
        }
    }
}

/** Port of Games/Arkanoid/ArkanoidPaddle.gd. */
class ArkanoidPaddle {
    private arkanoid: Arkanoid;
    public width = 4;
    public position = v(3, 19);
    private _direction = 0;
    private moveTimer = new TickTimer(10);
    public facing = v(0, -1);
    private slidBall = false;

    constructor(arkanoid: Arkanoid) {
        this.arkanoid = arkanoid;
        this.moveTimer.onTriggered = () => this.onMoveTimer();
        this.reset();
    }

    public get direction(): number {
        return this._direction;
    }

    public set direction(value: number) {
        this._direction = value;
        this.moveTimer.fireAndReset();
    }

    public reset() {
        this.width = 4;
        this.position = v(3, 19);
        this.direction = 0;
    }

    public render(device: Device) {
        const mainScreen = device.mainScreen;
        for (let i = 0; i < this.width; i += 1) {
            mainScreen.setPixel(this.position.x + i, this.position.y, true);
        }
    }

    public tick() {
        if (!this.isFaceTouchingBall()) {
            this.slidBall = false;
        }
        this.moveTimer.tick();
    }

    private onMoveTimer() {
        this.position.x += this._direction;
        this.position.x = clamp(this.position.x, 0, 10 - this.width);

        const ball = this.arkanoid.ball;
        if (
            this._direction !== 0 &&
            this.isFaceTouchingBall() &&
            !this.slidBall
        ) {
            ball.move(vAdd(ball.position, v(this._direction, 0)));
            ball.direction.y = -ball.direction.y;
            this.slidBall = true;
        }
    }

    private isFaceTouchingBall(): boolean {
        const ball = this.arkanoid.ball;
        return rectHasPoint(this.faceRectPos(), this.rectSize(), ball.position);
    }

    public rectPos(): Vec {
        return this.position;
    }

    public rectSize(): Vec {
        return v(this.width, 1);
    }

    public faceRectPos(): Vec {
        return vAdd(this.position, this.facing);
    }
}

/** Port of Games/Arkanoid/ArkanoidPlay.gd. */
class ArkanoidPlay extends GameState {
    private arkanoid: Arkanoid;

    constructor(root: GameRoot, arkanoid: Arkanoid) {
        super(root);
        this.arkanoid = arkanoid;
    }

    override bgRender() {
        this.arkanoid.renderGame();
    }

    override bgTick() {
        this.arkanoid.ball.tick();
        this.arkanoid.paddle.tick();
    }

    override bgInput(event: DeviceEvent) {
        if (event.type !== "key") return;

        if (event.pressed) {
            switch (event.key) {
                case "left":
                    this.arkanoid.paddle.direction = -1;
                    break;
                case "right":
                    this.arkanoid.paddle.direction = 1;
                    break;
                case "exit":
                    // Not in the original, but needed to leave the game.
                    this.root.popState();
                    return;
            }
        } else {
            if (!this.root.isKeyDown("left") && !this.root.isKeyDown("right")) {
                this.arkanoid.paddle.direction = 0;
            }
        }

        if (event.key === "fire") {
            this.arkanoid.ball.speed = event.pressed ? 5 : -10;
        }
    }
}

/** Port of Games/Arkanoid/Arkanoid.gd. */
export class Arkanoid extends GameState {
    public ball: ArkanoidBall;
    public paddle: ArkanoidPaddle;
    public level: ArkanoidLevel;

    constructor(root: GameRoot) {
        super(root);
        this.ball = new ArkanoidBall(this);
        this.paddle = new ArkanoidPaddle(this);
        this.level = new ArkanoidLevel();
    }

    public renderGame() {
        this.device.mainScreen.clear();
        this.ball.render(this.device);
        this.paddle.render(this.device);
        this.level.render(this.device);
    }

    override bgEnter() {
        this.root.pushState(new ArkanoidPlay(this.root, this));
    }

    override bgFocus() {
        this.root.popState();
    }
}
