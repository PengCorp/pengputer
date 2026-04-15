/** Class to track elapsed time and count ticks of defined length. */
export class Timer {
    private _length: number;
    private _time: number;

    constructor(length: number) {
        this._length = length;
        this._time = 0;
    }

    /**
     * @param time elapsed time to add to timer.
     */
    public tick(time: number) {
        this._time += time;
    }

    /**
     * Rewinds time by a single tick if elapsed time exceeds or matches length.
     * @returns `true` if timer wrapped. Check this in a loop to process all ticks.
     */
    public consumeTick() {
        if (this._time >= this._length) {
            this._time -= this._length;
            return true;
        }

        return false;
    }

    /** Resets the timer to 0. */
    public restart() {
        this._time = 0;
    }

    public getLength() {
        return this._length;
    }
}
