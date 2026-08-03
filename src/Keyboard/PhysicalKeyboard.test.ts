import { afterEach, describe, expect, test, vi } from "vitest";
import { Keyboard } from "./Keyboard";
import { PhysicalKeyboard } from "./PhysicalKeyboard";
import { Modifier } from "./types";

function keyboardEvent(
    type: "keydown" | "keyup",
    code: string,
    key: string,
): KeyboardEvent {
    return {
        code,
        key,
        preventDefault: vi.fn(),
        repeat: false,
        stopPropagation: vi.fn(),
        type,
    } as unknown as KeyboardEvent;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("PhysicalKeyboard focus handling", () => {
    test("clears queued events, auto-repeat, and transient modifiers on blur", () => {
        const listeners = new Map<string, (event: Event) => void>();
        vi.stubGlobal("window", {
            addEventListener: vi.fn(
                (type: string, listener: (event: Event) => void) => {
                    listeners.set(type, listener);
                },
            ),
        });
        const keyboard = new Keyboard();
        const physicalKeyboard = new PhysicalKeyboard(keyboard);
        const forwardedEvents = vi.fn();
        keyboard.addSource({
            onEvent: forwardedEvents,
            onRegister: vi.fn(),
            update: vi.fn(),
        });
        keyboard.addSource(physicalKeyboard);

        listeners.get("keydown")!(
            keyboardEvent("keydown", "ShiftLeft", "Shift"),
        );
        listeners.get("keydown")!(keyboardEvent("keydown", "Enter", "Enter"));
        physicalKeyboard.update(300);
        physicalKeyboard.update(60);

        expect(keyboard.getModifiers() & Modifier.SHIFT).toBe(Modifier.SHIFT);
        listeners.get("blur")!(new Event("blur"));

        expect(keyboard.getModifiers()).toBe(0);
        expect(forwardedEvents).toHaveBeenLastCalledWith(
            expect.objectContaining({ code: "Enter", pressed: false }),
        );
        expect(keyboard.getNextEvent()).toBeNull();
        physicalKeyboard.update(1000);
        expect(keyboard.getNextEvent()).toBeNull();
    });
});
