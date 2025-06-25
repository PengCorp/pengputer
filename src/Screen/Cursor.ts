import { Vector, vectorAdd, vectorClone } from "../Toolbox/Vector";
import { Size } from "../types";

interface Screen {
  getSize: () => Size;
}

export class Cursor {
  private position: Vector;
  private screen: Screen;

  constructor(screen: Screen) {
    this.position = { x: 0, y: 0 };
    this.screen = screen;
  }

  public getPosition() {
    return vectorClone(this.position);
  }

  public setPosition(pos: Vector) {
    const resolvedPosition = this.wrapPosition(pos);
    this.position = resolvedPosition;
  }

  public moveBy(delta: Vector) {
    const newPosition = vectorAdd(this.position, delta);
    this.position = this.wrapPosition(newPosition);
  }

  public moveToStartOfLine() {
    this.position.x = 0;
  }

  public moveToEndOfLine() {
    this.position.x = this.screen.getSize().w - 1;
  }

  public moveToEndOfScreen() {
    this.moveToEndOfLine();
    this.position.y = this.screen.getSize().h - 1;
  }

  public moveToStartOfScreen() {
    this.position.x = 0;
    this.position.y = 0;
  }

  public snapToScreen() {
    const screenSize = this.screen.getSize();
    if (this.position.y < 0) {
      this.position.y = 0;
    } else if (this.position.y >= screenSize.h) {
      this.position.y = screenSize.h - 1;
    }

    if (this.position.x < 0) {
      this.position.x = 0;
    } else if (this.position.x >= screenSize.w) {
      this.position.x = screenSize.w - 1;
    }
  }

  public getIsOutOfBounds() {
    const screenSize = this.screen.getSize();
    return (
      this.position.x < 0 ||
      this.position.x >= screenSize.w ||
      this.position.y < 0 ||
      this.position.y >= screenSize.h
    );
  }

  private wrapPosition(pos: Vector): Vector {
    const screenSize = this.screen.getSize();

    const newPos = vectorClone(pos);
    while (newPos.x < 0) {
      newPos.x += screenSize.w;
      newPos.y -= 1;
    }
    while (newPos.x >= screenSize.w) {
      newPos.x -= screenSize.w;
      newPos.y += 1;
    }
    return newPos;
  }
}
