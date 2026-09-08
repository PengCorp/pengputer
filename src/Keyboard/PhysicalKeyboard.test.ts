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

/**
 * `withDocument` gives the keyboard a page whose focus the test drives;
 * without it there is no `document` at all, which is the off-browser
 * case and means "always focused".
 */
function setUpKeyboard(withDocument: boolean = false) {
    const listeners = new Map<string, (event: Event) => void>();
    vi.stubGlobal("window", {
        addEventListener: vi.fn(
            (type: string, listener: (event: Event) => void) => {
                listeners.set(type, listener);
            },
        ),
    });

    const focus = { has: true };
    if (withDocument) {
        vi.stubGlobal("document", { hasFocus: () => focus.has });
    }

    const keyboard = new Keyboard();
    const physicalKeyboard = new PhysicalKeyboard(keyboard);
    const forwardedEvents = vi.fn();
    keyboard.addSource({
        onEvent: forwardedEvents,
        onRegister: vi.fn(),
        update: vi.fn(),
    });
    keyboard.addSource(physicalKeyboard);

    return { focus, forwardedEvents, keyboard, listeners, physicalKeyboard };
}

/** Every event still queued up, oldest first. */
function drain(keyboard: Keyboard) {
    const events = [];
    for (let event = keyboard.getNextEvent(); event; ) {
        events.push(event);
        event = keyboard.getNextEvent();
    }
    return events;
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

        const released = [keyboard.getNextEvent(), keyboard.getNextEvent()].map(
            (event) => [event?.code, event?.pressed],
        );

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

    /*
     * The download bug: a file save hands the keyboard to the browser's
     * own UI, the keyup goes there, and no blur we can act on arrives.
     * Enter would otherwise repeat for as long as the page stayed
     * unfocused, filling the screen with newlines.
     */
    test("lets go of a held key when focus is gone without a blur", () => {
        const { focus, keyboard, listeners, physicalKeyboard } =
            setUpKeyboard(true);

        listeners.get("keydown")!(keyboardEvent("keydown", "Enter", "Enter"));
        expect(drain(keyboard).map((e) => e.pressed)).toStrictEqual([true]);

        focus.has = false;

        /* long enough that autorepeat would have fired many times over */
        for (let frame = 0; frame < 60; frame += 1) physicalKeyboard.update(16);

        const events = drain(keyboard);
        expect(events.map((e) => [e.code, e.pressed])).toStrictEqual([
            ["Enter", false],
        ]);
    });

    test("keeps repeating while the page still has focus", () => {
        const { focus, keyboard, listeners, physicalKeyboard } =
            setUpKeyboard(true);

        focus.has = true;
        listeners.get("keydown")!(keyboardEvent("keydown", "Enter", "Enter"));
        for (let frame = 0; frame < 60; frame += 1) physicalKeyboard.update(16);

        const repeats = drain(keyboard).filter((e) => e.isAutoRepeat);
        expect(repeats.length).toBeGreaterThan(5);
    });

    test("does not keep flushing the event buffer while unfocused", () => {
        const { focus, keyboard, physicalKeyboard } = setUpKeyboard(true);

        focus.has = false;
        physicalKeyboard.update(16);

        /* something arriving after the release -- a paste, say -- must
         * survive the frames that follow */
        keyboard.sendKeyCode(null, "KeyA", true);
        for (let frame = 0; frame < 10; frame += 1) physicalKeyboard.update(16);

        expect(drain(keyboard).map((e) => e.code)).toStrictEqual(["KeyA"]);
    });
});
