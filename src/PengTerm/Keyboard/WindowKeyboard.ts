import { KeyCode } from "./KeyCode";
import { KeyboardEvent as TerminalKeyboardEvent, Keyboard } from "./types";

export class WindowKeyboard implements Keyboard {
  private buffer: TerminalKeyboardEvent[];
  private pressed: string[];

  constructor() {
    this.buffer = [];
    this.pressed = [];
    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;

    this.pressed.push(e.code);
    this.buffer.push({
      code: e.code as KeyCode,
      pressed: true,
    });
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    this.buffer.push({
      code: e.code as KeyCode,
      pressed: false,
    });
  }

  public take() {
    return this.buffer.shift();
  }

  public getIsKeyPressed(keyCode: KeyCode) {
    return this.pressed.includes(keyCode);
  }

  public getIsShift(): boolean {
    return (
      this.getIsKeyPressed("ShiftLeft") || this.getIsKeyPressed("ShiftRight")
    );
  }
}
