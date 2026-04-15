/** Wraps a value within the range [0, max). */
export const wrapMax = (value: number, max: number) => {
    while (value >= max) {
        value -= max;
    }
    while (value < 0) {
        value += max;
    }

    return value;
};

/** Clamps a value within the range [min, max]. */
export const clamp = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
};
