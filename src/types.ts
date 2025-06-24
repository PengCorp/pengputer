import { Vector } from "./Toolbox/Vector";

export type StringLike = string | Array<string>;

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export const getRectFromPositionAndSize = (pos: Vector, size: Size) => {
  return {
    x: pos.x,
    y: pos.y,
    w: size.w,
    h: size.h,
  };
};

export const getIsPositionInRect = (pos: Vector, rect: Rect) => {
  return (
    pos.x >= rect.x &&
    pos.y >= rect.y &&
    pos.x < rect.x + rect.w &&
    pos.y < rect.y + rect.h
  );
};
