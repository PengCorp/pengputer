import { describe, expect, test } from "vitest";
import { Keyboard } from "./Keyboard";

describe("Keyboard.isRealKeyPress", () => {
    test("accepts only a fresh press of a non-modifier key", () => {
        expect(
            Keyboard.isRealKeyPress({
                pressed: true,
                isModifier: false,
                isAutoRepeat: false,
            }),
        ).toBe(true);
        expect(
            Keyboard.isRealKeyPress({
                pressed: false,
                isModifier: false,
                isAutoRepeat: false,
            }),
        ).toBe(false);
        expect(
            Keyboard.isRealKeyPress({
                pressed: true,
                isModifier: true,
                isAutoRepeat: false,
            }),
        ).toBe(false);
        expect(
            Keyboard.isRealKeyPress({
                pressed: true,
                isModifier: false,
                isAutoRepeat: true,
            }),
        ).toBe(false);
    });
});
