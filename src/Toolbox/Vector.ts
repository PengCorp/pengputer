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

export const vectorDotProduct = (a: Vector, b: Vector) => {
  return a.x * b.x + a.y * b.y;
};

/** Reflects vector along a normal. */
export const vectorReflect = (v: Vector, n: Vector) => {
  const dot = vectorDotProduct(v, n);
  return {
    x: v.x - 2 * dot * n.x,
    y: v.y - 2 * dot * n.y,
  };
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

export const getDoRectsIntersect = (a: Rect, b: Rect) => {
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

export const getDoRectsTouch = (a: Rect, b: Rect) => {
  const ax0 = a.x;
  const ay0 = a.y;
  const ax1 = a.x + a.w;
  const ay1 = a.y + a.h;

  const bx0 = b.x;
  const by0 = b.y;
  const bx1 = b.x + b.w;
  const by1 = b.y + b.h;

  if (ay0 <= by0 && ay1 === by0 && ax0 <= bx1 && ax1 >= bx0) return true; // top

  if (ax0 <= bx0 && ax1 === bx0 && ay0 <= by1 && ay1 >= by0) return true; // left

  if (ax0 === bx1 && ax1 >= bx1 && ay0 <= by1 && ay1 >= by0) return true; // right

  if (ay0 === by1 && ay1 >= by1 && ax0 <= bx1 && ax1 >= bx0) return true; // bottom

  return false;
};

/** Returns -1 if a is to the left of b, 1 if to the right, 0 if overlapping on the X axis. */
export const compareRectsX = (a: Rect, b: Rect) => {
  const ax0 = a.x;
  const ax1 = a.x + a.w;

  const bx0 = b.x;
  const bx1 = b.x + b.w;

  if (ax0 <= bx0 && ax1 <= bx0) return -1;

  if (ax0 >= bx1 && ax1 >= bx1) return 1;

  return 0;
};

/** Returns -1 if a is above b, 1 if below, 0 if overlapping on the Y axis. */
export const compareRectsY = (a: Rect, b: Rect) => {
  const ay0 = a.y;
  const ay1 = a.y + a.h;

  const by0 = b.y;
  const by1 = b.y + b.h;

  if (ay0 <= by0 && ay1 <= by0) return -1;

  if (ay0 >= by1 && ay1 >= by1) return 1;

  return 0;
};

export const getUnitCircleVector = (angle: number) => {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
};
