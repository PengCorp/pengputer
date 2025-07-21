import { Keyboard } from "./Keyboard";
import { KeyCode } from "./types";

export class ScreenKeyboard {
  private keyboard!: Keyboard;
  public isShiftDown: boolean = false;
  public isCtrlDown: boolean = false;
  public isCapsOn: boolean = false;
  public isAltDown: boolean = false;
  public isMetaDown: boolean = false;

  private keysCapsLocks: HTMLSpanElement[] = [];
  private keysShifts: HTMLSpanElement[] = [];
  private keysControls: HTMLSpanElement[] = [];
  private keysAlts: HTMLSpanElement[] = [];
  private keysMeta: HTMLSpanElement[] = [];

  private screenKeyMap: Record<string, boolean> = {};

  constructor(keyboard: Keyboard) {
    this.keyboard = keyboard;

    const screenKeys = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span"),
    ];

    this.keysCapsLocks = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span.capsLock"),
    ];
    this.keysShifts = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span.shift"),
    ];
    this.keysControls = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span.ctrl"),
    ];
    this.keysAlts = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span.alt"),
    ];
    this.keysMeta = [
      ...document.querySelectorAll<HTMLSpanElement>(".row span.meta"),
    ];

    for (let screenKey of screenKeys) {
      const code = screenKey.getAttribute("code") || "";

      screenKey.addEventListener("mousedown", () => {
        this.onCodeDown(code as KeyCode);
      });

      screenKey.addEventListener("mouseleave", () => {
        this.onCodeUp(code as KeyCode);
      });

      screenKey.addEventListener("mouseup", () => {
        this.onCodeUp(code as KeyCode);
      });
    }
  }

  private setScreenKeyDown(keys: HTMLSpanElement[], isPressed: boolean) {
    for (let key of keys) {
      if (isPressed) {
        key.classList.add("key-down");
      } else {
        key.classList.remove("key-down");
      }
    }
  }

  private onCodeDown(code: KeyCode) {
    this.screenKeyMap[code] = true;
    if (code === "CapsLock") {
      this.isCapsOn = !this.isCapsOn;
      this.setScreenKeyDown(this.keysCapsLocks, this.isCapsOn);
      this.keyboard.forceCaps = this.isCapsOn;
    } else if (code === "ShiftLeft" || code === "ShiftRight") {
      this.isShiftDown = !this.isShiftDown;
      this.setScreenKeyDown(this.keysShifts, this.isShiftDown);
      this.keyboard.forceShift = this.isShiftDown;
    } else if (code === "ControlLeft" || code === "ControlRight") {
      this.isCtrlDown = !this.isCtrlDown;
      this.setScreenKeyDown(this.keysControls, this.isCtrlDown);
      this.keyboard.forceControl = this.isCtrlDown;
    } else if (code === "AltLeft" || code === "AltRight") {
      this.isAltDown = !this.isAltDown;
      this.setScreenKeyDown(this.keysAlts, this.isAltDown);
      this.keyboard.forceAlt = this.isAltDown;
    } else if (code === "MetaLeft" || code === "MetaRight") {
      this.isMetaDown = !this.isMetaDown;
      this.setScreenKeyDown(this.keysMeta, this.isMetaDown);
      this.keyboard.forceMeta = this.isMetaDown;
    } else if (code) {
      this.keyboard.handleKeyCode(code, true);
    }
  }

  private onCodeUp(code: KeyCode) {
    if (this.screenKeyMap[code] === true) {
      this.screenKeyMap[code] = false;

      if (code === "CapsLock") {
      } else if (code === "ShiftLeft" || code === "ShiftRight") {
      } else if (code === "ControlLeft" || code === "ControlRight") {
      } else if (code === "AltLeft" || code === "AltRight") {
      } else if (code === "MetaLeft" || code === "MetaRight") {
      } else if (code) {
        this.keyboard.handleKeyCode(code, false);
      }
    }
  }
}
