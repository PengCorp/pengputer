import { type KeyCode } from "../Keyboard";

export class AutoRepeat {
  #countdownTime: number;
  #countdown: number;

  #intervalTime: number;
  #interval: number;

  #keyCode: KeyCode | null;

  constructor(countdownTime: number, interval: number) {
    this.#countdownTime = this.#countdown = countdownTime;
    this.#intervalTime = this.#interval = interval;
    this.#keyCode = null;
  }

  public reset() {
    this.#countdown = this.#countdownTime;
    this.#interval = this.#intervalTime;
    this.#keyCode = null;
  }

  public setCode(code: KeyCode | null) {
    this.reset();
    this.#keyCode = code;
  }

  public getCode(): KeyCode | null {
    return this.#keyCode;
  }

  public update(deltaTime: number): boolean {
    if (!this.#keyCode) return false;

    if (this.#countdown > 0) {
      this.#countdown -= deltaTime;
      return false;
    } else {
      let ret = false;
      this.#interval -= deltaTime;
      while (this.#interval < 0) {
        ret = true;
        this.#interval += this.#intervalTime;
      }

      return ret;
    }
  }
}
