export type Vector = { x: number; y: number };

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

export const vectorMultiplyComponents = (a: Vector, b: Vector): Vector => {
  return { x: a.x * b.x, y: a.y * b.y };
};

export const vectorDivideComponents = (a: Vector, b: Vector): Vector => {
  return { x: Math.floor(a.x / b.x), y: Math.floor(a.y / b.y) };
};

export const vectorScale = (a: Vector, b: number): Vector => {
  return { x: a.x * b, y: a.y * b};
};

export const vectorMagnitude = (a:Vector): number => {
  return Math.sqrt(a.x * a.x + a.y * a.y);
};

export const vectorNormalized = (a:Vector): Vector => {
  return vectorScale(a, 1.0 / vectorMagnitude(a));
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
