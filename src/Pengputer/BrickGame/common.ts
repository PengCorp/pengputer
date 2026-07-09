/*
 * Shared game pieces: the explosion and curtain animations and the states that
 * wrap them, used by Snake and Frogger when the player dies.
 */

import { TickTimer, type Vec } from "./core";
import { GameState, type GameRoot } from "./GameRoot";
import { type Device } from "./Device";

export enum ExplodeStep {
    Explode,
    Curtain,
    End,
}

/** Port of Objects/Explosion.gd. */
class Explosion {
    private animTimer = new TickTimer(5);
    private animFrame = 0;
    private static readonly ANIM_FRAMES = [
        "*  * **  ** *  *",
        " ** *  **  * ** ",
    ];
    private static readonly SIZE = 4;
    public x = 0;
    public y = 0;

    constructor() {
        this.animTimer.onTriggered = () => {
            this.animFrame += 1;
            if (this.animFrame >= Explosion.ANIM_FRAMES.length) {
                this.animFrame = 0;
            }
        };
    }

    public tick() {
        this.animTimer.tick();
    }

    public render(device: Device) {
        const frame = Explosion.ANIM_FRAMES[this.animFrame];
        for (let i = 0; i < frame.length; i += 1) {
            device.mainScreen.setPixel(
                (i % Explosion.SIZE) + this.x,
                Math.floor(i / Explosion.SIZE) + this.y,
                frame[i] === "*",
            );
        }
    }
}

/** Port of Games/Common/Explode.gd. */
export class ExplodeState extends GameState {
    private explosion = new Explosion();
    private explosionTimer = new TickTimer(60 * 2);

    constructor(root: GameRoot) {
        super(root);
        this.explosionTimer.onTriggered = () => this.root.popState();
    }

    public setLocation(location: Vec) {
        this.explosion.x = location.x;
        this.explosion.y = location.y;
    }

    override bgRender() {
        this.explosion.render(this.device);
    }

    override bgTick() {
        this.explosion.tick();
        this.explosionTimer.tick();
    }
}

/** Port of Objects/Curtain.gd. */
class Curtain {
    private animTimer = new TickTimer(2);
    public ended = false;
    private frame = 0;

    constructor() {
        this.animTimer.onTriggered = () => {
            this.frame += 1;
            if (this.frame === 40) {
                this.ended = true;
            }
        };
    }

    public tick() {
        this.animTimer.tick();
    }

    public render(device: Device) {
        if (this.frame >= 1 && this.frame <= 20) {
            for (let i = 0; i < 10; i += 1) {
                device.mainScreen.setPixel(i, 20 - this.frame, true);
            }
        }
        if (this.frame >= 21 && this.frame <= 40) {
            for (let i = 0; i < 10; i += 1) {
                device.mainScreen.setPixel(i, this.frame - 21, false);
            }
        }
    }
}

/** Port of Games/Common/Curtain.gd. */
export class CurtainState extends GameState {
    private curtain = new Curtain();

    override bgTick() {
        this.curtain.tick();
        if (this.curtain.ended) {
            this.root.popState();
        }
    }

    override bgRender() {
        this.curtain.render(this.device);
    }
}
