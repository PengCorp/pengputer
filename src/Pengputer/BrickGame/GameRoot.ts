/*
 * The state-stack framework, ported from Games/GameRoot.gd + GameState.gd but
 * built on Pengputer's StateManager.
 */

import { State, StateManager } from "@Toolbox/StateManager";
import { type DeviceEvent, type DeviceKey } from "./core";
import { type Device } from "./Device";

/**
 * Port of Games/GameState.gd, built on Pengputer's StateManager `State`.
 *
 * StateManager's lifecycle callbacks (onEnter/onFocus/onBlur/onLeave) are
 * mapped onto BrickGame's (bgEnter/bgFocus/bgBlur/bgLeave). The one semantic
 * gap is focus: StateManager fires `onFocus` whenever a state is pushed or
 * made the target of a replace, whereas BrickGame only wants focus when a
 * state is *revealed* by popping the state above it. We bridge this by only
 * dispatching `bgFocus` when this state is actually the top of the stack.
 * Every wrapper state (Intro/Snake/Frogger/Arkanoid/...Explode) pushes a
 * child during its own `bgEnter`, so it is never the top when its spurious
 * push/replace focus fires - the guard turns those into no-ops while
 * preserving the genuine reveal-by-pop focus the exit logic relies on.
 */
export abstract class GameState extends State {
    protected root: GameRoot;
    protected device: Device;

    constructor(root: GameRoot) {
        super();
        this.root = root;
        this.device = root.device;
    }

    override onEnter(): void {
        this.bgEnter();
    }

    override onLeave(): void {
        this.bgLeave();
    }

    override onBlur(): void {
        super.onBlur();
        this.bgBlur();
    }

    override onFocus(): void {
        super.onFocus();
        if (this.root.getTopState() === this) {
            this.bgFocus();
        }
    }

    bgEnter(): void {}
    bgLeave(): void {}
    bgFocus(): void {}
    bgBlur(): void {}
    bgTick(): void {}
    bgRender(): void {}
    bgInput(_event: DeviceEvent): void {}
}

/**
 * Port of Games/GameRoot.gd. The state stack itself is Pengputer's
 * StateManager; this adds the device handle and the global key-down map, and
 * drives tick/render on the top state (BrickGame ticks/renders only the top,
 * so we don't use StateManager.update which fans out across the whole stack).
 */
export class GameRoot {
    public device: Device;
    private manager = new StateManager();

    private keyDownMap: Record<DeviceKey, boolean> = {
        up: false,
        down: false,
        left: false,
        right: false,
        fire: false,
        fire2: false,
        start: false,
        pause: false,
        reset: false,
        exit: false,
    };

    constructor(device: Device) {
        this.device = device;
    }

    public isKeyDown(key: DeviceKey): boolean {
        return this.keyDownMap[key];
    }

    public getTopState(): GameState | null {
        return this.manager.getTopState() as GameState | null;
    }

    public pushState(state: GameState) {
        this.manager.pushState(state);
    }

    public popState() {
        this.manager.popState();
    }

    public replaceState(state: GameState) {
        this.manager.replaceState(state);
    }

    public bgTick() {
        this.getTopState()?.bgTick();
    }

    public bgRender() {
        this.getTopState()?.bgRender();
    }

    public bgInput(event: DeviceEvent) {
        if (event.type === "key") {
            this.keyDownMap[event.key] = event.pressed;
        }
        this.getTopState()?.bgInput(event);
    }

    public size(): number {
        return this.manager.getStackLength();
    }
}
