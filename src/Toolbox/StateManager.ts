export abstract class State {
  /** Run when state is added to stack. */
  onEnter(): void {}

  /** Run when state enters focus either when added or revealed by removing another state. */
  onFocus(): void {
    this.isFocused = true;
  }

  update(dt: number): void {}

  /** Run when state is covered by another state in stack or removed from stack. */
  onBlur(): void {
    this.isFocused = false;
  }

  /** Run when state is removed from stack. */
  onLeave(): void {}

  /* Focus state. */

  private isFocused: boolean = false;

  protected getIsFocused() {
    return this.isFocused;
  }
}

export class StateManager {
  private stack: State[];

  constructor() {
    this.stack = [];
  }

  public getTopState() {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  public getStackLength() {
    return this.stack.length;
  }

  public getIsEmpty() {
    return this.stack.length === 0;
  }

  public popAllStates() {
    while (this.stack.length > 0) {
      this.popState();
    }
  }

  public pushState(newState: State) {
    const previousTopState = this.getTopState();

    if (previousTopState !== null) {
      previousTopState.onBlur();
    }

    this.stack.push(newState);

    newState.onEnter();
    newState.onFocus();
  }

  public popState() {
    const poppedState = this.stack.pop();

    if (!poppedState) {
      throw new Error("No state to pop.");
    }

    if (poppedState) {
      poppedState.onBlur();
      poppedState.onLeave();
    }

    const newTop = this.getTopState();

    if (newTop) {
      newTop.onFocus();
    }
  }

  public replaceState(newState: State) {
    const topState = this.stack.pop();

    if (!topState) {
      this.pushState(newState);
      return;
    }

    topState.onBlur();
    topState.onLeave();

    this.stack.push(newState);

    newState.onEnter();
    newState.onFocus();
  }

  public update(dt: number) {
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      this.stack[i].update(dt);
    }
  }
}
