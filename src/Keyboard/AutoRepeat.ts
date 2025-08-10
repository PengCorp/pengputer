import {
  Modifier,
  type KeyboardSource,
  type KeyCode,
  type PengKeyboardEvent
} from "../Keyboard";

export class AutoRepeat {
  private _countdownTime: number;
  private _countdown: number;

  private _intervalTime: number;
  private _interval: number;

  private _keyCode: KeyCode|null;

  constructor(countdownTime: number, interval: number) {
    this._countdownTime = this._countdown = countdownTime;
    this._intervalTime = this._interval = interval;
    this._keyCode = null;
  }

  public reset() {
    this._countdown = this._countdownTime;
    this._interval = this._intervalTime;
    this._keyCode = null;
  }

  public setCode(code: KeyCode|null) {
    this.reset();
    this._keyCode = code;
  }

  public getCode(): KeyCode|null {
    return this._keyCode;
  }

  public update(deltaTime: number): boolean {
    if(!this._keyCode) return false; /* no configured key */

    if(this._countdown > 0) {
      this._countdown -= deltaTime;
      return false; /* not yet time */
    } else {
      let ret = false;
      this._interval -= deltaTime;
      while(this._interval < 0) {
        ret = true;
        this._interval += this._intervalTime;
      }

      return ret;
    }
  }
};
