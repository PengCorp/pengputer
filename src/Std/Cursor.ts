import { Vector, vectorAdd, vectorClone } from "../Toolbox/Vector";
import { Size } from "../types";

export class Cursor {
  private position: Vector;
  private screenSize: Size;

  constructor(screenSize: Size) {
    this.position = { x: 0, y: 0 };
    this.screenSize = { w: screenSize.w, h: screenSize.h };
  }

  public getPosition() {
    return vectorClone(this.position);
  }

  public setPosition(pos: Vector) {
    const resolvedPosition = this._resolveCursorPosition(pos, false);
    this.position = resolvedPosition;
  }

  public moveBy(delta: Vector, shouldWrap: boolean = false) {
    const newPosition = vectorAdd(this.position, delta);
    const resolvedPosition = this._resolveCursorPosition(
      newPosition,
      shouldWrap
    );

    let scrolledLines = 0;
    if (resolvedPosition.y >= this.screenSize.h) {
      scrolledLines = resolvedPosition.y - (this.screenSize.h - 1);
      resolvedPosition.y = this.screenSize.h - 1;
    }

    this.position = resolvedPosition;

    return { scrolledLines };
  }

  private _resolveCursorPosition(
    pos: Vector,
    shouldWrap: boolean = false
  ): Vector {
    if (shouldWrap) {
      const newPos = { x: pos.x, y: pos.y };
      while (newPos.x < 0) {
        newPos.x += this.screenSize.w;
        newPos.y -= 1;
      }
      while (newPos.x >= this.screenSize.w) {
        newPos.x -= this.screenSize.w;
        newPos.y += 1;
      }
      return newPos;
    } else {
      return {
        x: Math.max(0, Math.min(this.screenSize.w - 1, pos.x)),
        y: Math.max(0, Math.min(this.screenSize.h - 1, pos.y)),
      };
    }
  }
}
