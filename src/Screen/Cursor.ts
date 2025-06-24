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
    const resolvedPosition = this.wrapOrClampPosition(pos, false);
    this.position = resolvedPosition;
  }

  public moveBy(delta: Vector, shouldWrap: boolean = false) {
    const screenSize = this.screen.getSize();

    const newPosition = vectorAdd(this.position, delta);
    const resolvedPosition = this.wrapOrClampPosition(newPosition, shouldWrap);

    let scrolledLines = 0;
    if (resolvedPosition.y >= screenSize.h) {
      scrolledLines = resolvedPosition.y - (screenSize.h - 1);
      resolvedPosition.y = screenSize.h - 1;
    }

    this.position = resolvedPosition;

    return { scrolledLines };
  }

  private wrapOrClampPosition(
    pos: Vector,
    shouldWrap: boolean = false
  ): Vector {
    const screenSize = this.screen.getSize();

    if (shouldWrap) {
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
    } else {
      return {
        x: Math.max(0, Math.min(screenSize.w - 1, pos.x)),
        y: Math.max(0, Math.min(screenSize.h - 1, pos.y)),
      };
    }
  }
}
