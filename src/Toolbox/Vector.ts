export type Vector = { x: number; y: number };

export type Point = Vector;

export const vectorAdd = (a: Vector, b: Vector) => {
  return { x: a.x + b.x, y: a.y + b.y };
};

export const vectorSubtract = (a: Vector, b: Vector) => {
  return { x: a.x - b.x, y: a.y - b.y };
};

export const vectorEqual = (a: Vector, b: Vector) => {
  return a.x === b.x && a.y === b.y;
};

export const vectorClone = (a: Vector): Vector => {
  return { x: a.x, y: a.y };
};

export const vectorDivideByNumberFloored = (a: Vector, b: number) => {
  return {
    x: Math.floor(a.x / b),
    y: Math.floor(a.y / b),
  };
};

export const vectorMultiplyComponents = (a: Vector, b: Vector): Vector => {
  return { x: a.x * b.x, y: a.y * b.y };
};

export const vectorDivideComponents = (a: Vector, b: Vector): Vector => {
  return { x: Math.floor(a.x / b.x), y: Math.floor(a.y / b.y) };
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const vectorClamp = (a: Vector, r: Rect) => {
  return {
    x: Math.max(r.x, Math.min(a.x, r.x + r.w - 1)),
    y: Math.max(r.y, Math.min(a.y, r.y + r.h - 1)),
  };
};

export const zeroVector = { x: 0, y: 0 };

export const getDoesPointIntersectRect = (point: Point, rect: Rect) => {
  return (
    point.x > rect.x &&
    point.y > rect.y &&
    point.x < rect.x + rect.w &&
    point.y < rect.y + rect.h
  );
};

export const getDoRectsOverlap = (a: Rect, b: Rect) => {
  const ax0 = a.x;
  const ay0 = a.y;
  const ax1 = a.x + a.w;
  const ay1 = a.y + a.h;

  const bx0 = b.x;
  const by0 = b.y;
  const bx1 = b.x + b.w;
  const by1 = b.y + b.h;

  return ax0 < bx1 && ay0 < by1 && ax1 >= bx0 && ay1 >= by0;
};

export const getRectWithPosition = (r: Rect, p: Vector) => {
  return {
    x: p.x,
    y: p.y,
    w: r.w,
    h: r.h,
  };
};

export const getRectMovedBy = (r: Rect, d: Vector) => {
  return {
    x: r.x + d.x,
    y: r.y + d.y,
    w: r.w,
    h: r.h,
  };
};
