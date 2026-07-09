/* Port of Games/Frogger. */

import { type DeviceEvent, TickTimer, v, type Vec } from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { CurtainState, ExplodeState, ExplodeStep } from "./common";

/** Port of Games/Frogger/Frogger.gd. */
export class Frogger extends GameState {
    private height = 3;
    private playerX = 0;
    private playerY = 0;
    private fieldWidth: number;
    private goals: boolean[] = [];
    private initialLives = 3;
    public lives = 3;
    private cars: boolean[][] = [];
    private carsStates: boolean[] = [];
    private carsCounts: number[] = [];
    private carMoveTimer = new TickTimer(20);
    private playerBlinkTimer = new TickTimer(5);
    private playerBlinkOn = false;

    constructor(root: GameRoot) {
        super(root);
        this.fieldWidth = this.device.mainScreen.arraySize.x;
        this.playerBlinkTimer.onTriggered = () => {
            this.playerBlinkOn = !this.playerBlinkOn;
        };
        this.carMoveTimer.onTriggered = () => {
            for (let carRowI = 0; carRowI < this.height; carRowI += 1) {
                this.pushCar(carRowI);
            }
        };
    }

    override bgEnter() {
        this.device.mainScreen.clear();
        this.resetGame();
        this.root.pushState(new FroggerStart(this.root, this));
    }

    override bgFocus() {
        this.root.popState();
    }

    public resetPlayer() {
        this.playerX = Math.floor(this.fieldWidth / 2) - 1;
        this.playerY = 0;
    }

    public resetGoals() {
        this.goals = [];
        for (let i = 0; i < this.fieldWidth; i += 1) this.goals.push(false);
    }

    public resetCars() {
        this.cars = [];
        this.carsStates = [];
        this.carsCounts = [];

        for (let h = 0; h < this.height; h += 1) {
            this.cars.push([]);
            this.carsStates.push(false);
            this.carsCounts.push(0);
        }

        for (let h = 0; h < this.height; h += 1) {
            this.carsStates[h] = Math.floor(Math.random() * 2) === 0;
            this.carsCounts[h] = Math.floor(Math.random() * 4) + 2;
            for (let c = 0; c < this.fieldWidth; c += 1) {
                this.pushCar(h, true);
            }
        }
    }

    private resetGame() {
        this.lives = this.initialLives;
        this.resetPlayer();
        this.resetGoals();
        this.resetCars();
    }

    private explodePlayer() {
        this.lives -= 1;
        this.root.replaceState(new FroggerExplode(this.root, this));
    }

    private pushCar(rowI: number, noPop = false) {
        const row = this.cars[rowI];
        const value = this.carsStates[rowI];
        const pushPlayer = this.playerY === rowI + 1;

        if (rowI % 2 === 0) {
            if (!noPop) row.shift();
            row.push(value);
            if (pushPlayer) this.movePlayer("left");
        } else {
            if (!noPop) row.pop();
            row.unshift(value);
            if (pushPlayer) this.movePlayer("right");
        }

        this.carsCounts[rowI] -= 1;
        if (this.carsCounts[rowI] === 0) {
            this.carsStates[rowI] = !this.carsStates[rowI];
            this.carsCounts[rowI] = Math.floor(Math.random() * 4) + 2;
        }

        this.checkCollisions();
    }

    private markGoal() {
        this.goals[this.playerX] = true;
        let count = 0;
        for (const goal of this.goals) if (goal) count += 1;
        if (count >= 5) {
            this.resetGoals();
            this.resetCars();
            this.root.replaceState(new FroggerStart(this.root, this));
        }
    }

    public movePlayer(dir: "left" | "right" | "up" | "down") {
        switch (dir) {
            case "left":
                this.playerX -= 1;
                this.resetPlayerBlink();
                if (this.playerX < 0) this.playerX = this.fieldWidth - 1;
                break;
            case "right":
                this.playerX += 1;
                this.resetPlayerBlink();
                if (this.playerX >= this.fieldWidth) this.playerX = 0;
                break;
            case "up":
                if (
                    this.playerY < this.height + 1 ||
                    !this.goals[this.playerX]
                ) {
                    this.playerY += 1;
                    this.resetPlayerBlink();
                    if (this.playerY === this.height + 2) {
                        this.markGoal();
                        this.resetPlayer();
                    }
                }
                break;
            case "down":
                if (this.playerY > 0) {
                    this.playerY -= 1;
                    this.resetPlayerBlink();
                }
                break;
        }
        this.checkCollisions();
    }

    private checkCollisions() {
        if (this.playerY > 0 && this.playerY < this.height + 1) {
            const playerCarY = this.playerY - 1;
            if (this.cars[playerCarY][this.playerX] === true) {
                this.explodePlayer();
            }
        }
    }

    public getPlayerPos(): Vec {
        const mainScreen = this.device.mainScreen;
        return v(this.playerX, mainScreen.arraySize.y - 1 - this.playerY * 2);
    }

    public inputFrog(event: DeviceEvent) {
        if (event.type !== "key" || !event.pressed) return;
        switch (event.key) {
            case "left":
                this.movePlayer("left");
                break;
            case "right":
                this.movePlayer("right");
                break;
            case "up":
                this.movePlayer("up");
                break;
            case "down":
                this.movePlayer("down");
                break;
            case "exit":
                this.root.popState();
                break;
        }
    }

    public tickFrog() {
        this.playerBlinkTimer.tick();
    }

    public tickCars() {
        this.carMoveTimer.tick();
    }

    private resetPlayerBlink() {
        this.playerBlinkOn = true;
        this.playerBlinkTimer.reset();
    }

    public renderLives() {
        const hintScreen = this.device.hintScreen;
        hintScreen.clear();
        hintScreen.setCount(this.lives);
    }

    public renderGoals() {
        const mainScreen = this.device.mainScreen;
        for (let goalI = 0; goalI < this.fieldWidth; goalI += 1) {
            mainScreen.setPixel(
                goalI,
                mainScreen.arraySize.y - 1 - 1 - (this.height + 1) * 2,
                Boolean(this.goals[goalI]),
            );
        }
    }

    public renderLevel() {
        const mainScreen = this.device.mainScreen;
        let y = mainScreen.arraySize.y - 2;
        for (let i = 0; i < this.height; i += 1) {
            for (let x = 0; x < mainScreen.arraySize.x; x += 1) {
                mainScreen.setPixel(x, y, true);
            }
            y -= 1;
            for (let carI = 0; carI < this.cars[i].length; carI += 1) {
                mainScreen.setPixel(carI, y, this.cars[i][carI]);
            }
            y -= 1;
        }
        for (let x = 0; x < mainScreen.arraySize.x; x += 1) {
            mainScreen.setPixel(x, y, true);
        }
    }

    public renderFrog() {
        const mainScreen = this.device.mainScreen;
        const playerPos = this.getPlayerPos();
        mainScreen.setPixel(playerPos.x, playerPos.y, this.playerBlinkOn);
    }
}

/** Port of Games/Frogger/FroggerStart.gd. */
class FroggerStart extends GameState {
    private startTimer = new TickTimer(60);
    private frogger: Frogger;

    constructor(root: GameRoot, frogger: Frogger) {
        super(root);
        this.frogger = frogger;
        this.startTimer.onTriggered = () => {
            this.root.replaceState(new FroggerPlay(this.root, this.frogger));
        };
    }

    override bgEnter() {
        this.frogger.resetPlayer();
        this.frogger.resetCars();
        this.frogger.resetGoals();
        if (this.frogger.lives <= 0) {
            this.root.popState();
        }
    }

    override bgTick() {
        this.startTimer.tick();
        this.frogger.tickFrog();
    }

    override bgRender() {
        this.device.mainScreen.clear();
        this.frogger.renderLevel();
        this.frogger.renderGoals();
        this.frogger.renderFrog();
        this.frogger.renderLives();
    }
}

/** Port of Games/Frogger/FroggerPlay.gd. */
class FroggerPlay extends GameState {
    private frogger: Frogger;

    constructor(root: GameRoot, frogger: Frogger) {
        super(root);
        this.frogger = frogger;
    }

    override bgInput(event: DeviceEvent) {
        this.frogger.inputFrog(event);
    }

    override bgRender() {
        this.device.mainScreen.clear();
        this.frogger.renderLevel();
        this.frogger.renderGoals();
        this.frogger.renderFrog();
        this.frogger.renderLives();
    }

    override bgTick() {
        this.frogger.tickFrog();
        this.frogger.tickCars();
    }
}

/** Port of Games/Frogger/FroggerExplode.gd. */
class FroggerExplode extends GameState {
    private frogger: Frogger;
    private step = ExplodeStep.Explode;

    constructor(root: GameRoot, frogger: Frogger) {
        super(root);
        this.frogger = frogger;
    }

    override bgEnter() {
        const playerPos = this.frogger.getPlayerPos();
        const explode = new ExplodeState(this.root);
        explode.setLocation(v(playerPos.x - 1, playerPos.y - 1));
        this.root.pushState(explode);
    }

    override bgFocus() {
        this.step += 1;
        switch (this.step) {
            case ExplodeStep.Curtain:
                if (this.frogger.lives === 0) {
                    this.root.pushState(new CurtainState(this.root));
                } else {
                    this.bgFocus();
                }
                break;
            case ExplodeStep.End:
                this.root.replaceState(
                    new FroggerStart(this.root, this.frogger),
                );
                break;
        }
    }
}
