/** Class to track elapsed time and count ticks of defined length. */
export class Timer {
  #length: number;
  #time: number;

  constructor(length: number) {
    this.#length = length;
    this.#time = 0;
  }

  /**
   * @param time elapsed time to add to timer.
   */
  public tick(time: number) {
    this.#time += time;
  }

  /**
   * Rewinds time by a single tick if elapsed time exceeds or matches length.
   * @returns `true` if timer wrapped. Check this in a loop to process all ticks.
   */
  public checkWrap() {
    if (this.#time >= this.#length) {
      this.#time -= this.#length;
      return true;
    }

    return false;
  }

  /** Resets the timer to 0. */
  public restart() {
    this.#time = 0;
  }

  public getLength() {
    return this.#length;
  }
}
