/*
 * Shared device primitives for the BrickGame port - the small value types and
 * the hardware-ish building blocks (tick timer, pixel array, segment display)
 * that the device and every game are built on.
 */

export interface Vec {
    x: number;
    y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const vAdd = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const vEq = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
export const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

/** Godot Rect2.has_point: left/top inclusive, right/bottom exclusive. */
export const rectHasPoint = (pos: Vec, size: Vec, point: Vec): boolean =>
    point.x >= pos.x &&
    point.x < pos.x + size.x &&
    point.y >= pos.y &&
    point.y < pos.y + size.y;

export type DeviceKey =
    | "up"
    | "down"
    | "left"
    | "right"
    | "fire"
    | "fire2"
    | "start"
    | "pause"
    | "reset"
    | "exit";

export interface DeviceEvent {
    type: "key";
    pressed: boolean;
    key: DeviceKey;
}

/** Port of Util/TickTimer.gd - counts down ticks, fires when it hits zero. */
export class TickTimer {
    public length: number;
    public ticks: number;
    public paused: boolean = false;
    public isTriggered: boolean = false;
    public onTriggered: (() => void) | null = null;

    constructor(length: number) {
        this.length = length;
        this.ticks = length;
    }

    /** Matches the Godot `length` setter, which also resets `ticks`. */
    public setLength(length: number) {
        this.length = length;
        this.ticks = length;
    }

    private setTriggered(value: boolean) {
        this.isTriggered = value;
        if (value && this.onTriggered) {
            this.onTriggered();
        }
    }

    public tick() {
        if (this.paused) return;
        this.ticks -= 1;
        if (this.ticks <= 0) {
            this.setTriggered(true);
            this.ticks = this.length;
        } else {
            this.setTriggered(false);
        }
    }

    public reset() {
        this.ticks = this.length;
        this.isTriggered = false;
        this.paused = false;
    }

    public fireAndReset() {
        this.reset();
        this.setTriggered(true);
    }
}

/** Port of Nodes/PixelArray/PixelArray.gd - a grid of on/off pixels. */
export class PixelArray {
    public arraySize: Vec;
    private pixels: boolean[];

    constructor(width: number, height: number) {
        this.arraySize = v(width, height);
        this.pixels = new Array(width * height).fill(false);
    }

    public clear() {
        this.pixels.fill(false);
    }

    public setPixel(x: number, y: number, value: boolean) {
        if (x < 0 || x > this.arraySize.x - 1) return;
        if (y < 0 || y > this.arraySize.y - 1) return;
        this.pixels[y * this.arraySize.x + x] = value;
    }

    public getPixel(x: number, y: number): boolean {
        return this.pixels[y * this.arraySize.x + x];
    }

    /** Lights the first `count` pixels in reading order (used for lives). */
    public setCount(count: number) {
        for (let i = 0; i < count; i += 1) {
            this.pixels[i] = true;
        }
    }
}

/** Port of Nodes/SevenSegment - we just track the displayed number. */
export class SegmentDisplay {
    public digits: number;
    public value: number | null;

    constructor(digits: number) {
        this.digits = digits;
        this.value = 0;
    }

    public setNumber(value: number) {
        this.value = value;
    }

    public clearDigits() {
        this.value = null;
    }
}
