import { describe, expect, test } from "vitest";
import { Timer } from "./Timer";

describe("Timer", () => {
    test("does not wrap before length is reached", () => {
        const t = new Timer(100);
        t.tick(50);
        expect(t.consumeTick()).toBe(false);
    });

    test("wraps when time reaches length", () => {
        const t = new Timer(100);
        t.tick(100);
        expect(t.consumeTick()).toBe(true);
        expect(t.consumeTick()).toBe(false);
    });

    test("wraps when time exceeds length", () => {
        const t = new Timer(100);
        t.tick(150);
        expect(t.consumeTick()).toBe(true);
        // 50 remaining, not enough for another wrap
        expect(t.consumeTick()).toBe(false);
    });

    test("accumulates multiple ticks", () => {
        const t = new Timer(100);
        t.tick(30);
        t.tick(30);
        t.tick(30);
        expect(t.consumeTick()).toBe(false);
        t.tick(30);
        expect(t.consumeTick()).toBe(true);
    });

    test("multiple wraps from a single large tick", () => {
        const t = new Timer(100);
        t.tick(250);
        expect(t.consumeTick()).toBe(true);
        expect(t.consumeTick()).toBe(true);
        expect(t.consumeTick()).toBe(false);
    });

    test("restart resets accumulated time", () => {
        const t = new Timer(100);
        t.tick(90);
        t.restart();
        t.tick(50);
        expect(t.consumeTick()).toBe(false);
    });

    test("getLength returns configured length", () => {
        const t = new Timer(64);
        expect(t.getLength()).toBe(64);
    });
});
