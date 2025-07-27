export const wrapMax = (value: number, max: number) => {
  while (value >= max) {
    value -= max;
  }
  while (value < 0) {
    value += max;
  }

  return value;
};

export const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};
