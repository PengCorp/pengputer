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

function setUpKeyboard() {
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

    return { forwardedEvents, keyboard, listeners, physicalKeyboard };
}

describe("PhysicalKeyboard focus handling", () => {
    test("clears queued events, auto-repeat, and transient modifiers on blur", () => {
        const { forwardedEvents, keyboard, listeners, physicalKeyboard } =
            setUpKeyboard();

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

        /* the release has to reach the consumers of the event buffer,
         * and nothing may be queued after it */
        expect(keyboard.getNextEvent()).toStrictEqual(
            expect.objectContaining({ code: "Enter", pressed: false }),
        );
        expect(keyboard.getNextEvent()).toBeNull();
        physicalKeyboard.update(1000);
        expect(keyboard.getNextEvent()).toBeNull();
    });

    test("releases every held key on blur, not just the last one", () => {
        const { keyboard, listeners, physicalKeyboard } = setUpKeyboard();

        listeners.get("keydown")!(
            keyboardEvent("keydown", "ArrowLeft", "ArrowLeft"),
        );
        listeners.get("keydown")!(
            keyboardEvent("keydown", "ArrowDown", "ArrowDown"),
        );
        listeners.get("blur")!(new Event("blur"));

        const released = [
            keyboard.getNextEvent(),
            keyboard.getNextEvent(),
        ].map((event) => [event?.code, event?.pressed]);

        expect(released).toStrictEqual([
            ["ArrowLeft", false],
            ["ArrowDown", false],
        ]);
        expect(keyboard.getNextEvent()).toBeNull();
        physicalKeyboard.update(1000);
        expect(keyboard.getNextEvent()).toBeNull();
    });

    test("does not release keys that were let go before the blur", () => {
        const { keyboard, listeners } = setUpKeyboard();

        listeners.get("keydown")!(keyboardEvent("keydown", "KeyA", "a"));
        listeners.get("keyup")!(keyboardEvent("keyup", "KeyA", "a"));
        listeners.get("blur")!(new Event("blur"));

        expect(keyboard.getNextEvent()).toBeNull();
    });
});
