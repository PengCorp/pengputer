import { Vector } from "./Toolbox/Vector";

export type StringLike = string | Array<string>;

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export const getRectFromVectorAndSize = (vec: Vector, size: Size) => {
  return {
    x: vec.x,
    y: vec.y,
    w: size.w,
    h: size.h,
  };
};

export const getIsVectorInRect = (vec: Vector, rect: Rect) => {
  return (
    vec.x >= rect.x &&
    vec.y >= rect.y &&
    vec.x < rect.x + rect.w &&
    vec.y < rect.y + rect.h
  );
};
