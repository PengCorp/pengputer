import { describe, expect, test } from "vitest";
import { Signal } from "./Signal";

describe("Signal", () => {
    test("listener receives emitted data", () => {
        const signal = new Signal<number>();
        let received: number | undefined;
        signal.listen((data) => {
            received = data;
        });
        signal.emit(42);
        expect(received).toBe(42);
    });

    test("multiple listeners all fire", () => {
        const signal = new Signal<string>();
        const calls: string[] = [];
        signal.listen((data) => calls.push("a:" + data));
        signal.listen((data) => calls.push("b:" + data));
        signal.emit("hello");
        expect(calls).toStrictEqual(["a:hello", "b:hello"]);
    });

    test("unsubscribe stops delivery", () => {
        const signal = new Signal<number>();
        let count = 0;
        const unsub = signal.listen(() => {
            count++;
        });
        signal.emit(1);
        unsub();
        signal.emit(2);
        expect(count).toBe(1);
    });

    test("unsubscribe during emit is safe", () => {
        const signal = new Signal<void>();
        const calls: string[] = [];
        let unsub: () => void;
        unsub = signal.listen(() => {
            calls.push("a");
            unsub();
        });
        signal.listen(() => calls.push("b"));

        signal.emit();
        expect(calls).toStrictEqual(["a", "b"]);

        calls.length = 0;
        signal.emit();
        expect(calls).toStrictEqual(["b"]);
    });

    test("listenOnce fires only once", () => {
        const signal = new Signal<number>();
        let count = 0;
        signal.listenOnce(() => {
            count++;
        });
        signal.emit(1);
        signal.emit(2);
        expect(count).toBe(1);
    });

    test("getPromise resolves with emitted value", async () => {
        const signal = new Signal<string>();
        const promise = signal.getPromise();
        signal.emit("done");
        expect(await promise).toBe("done");
    });

    test("getPromise resolves only with first emit", async () => {
        const signal = new Signal<number>();
        const promise = signal.getPromise();
        signal.emit(1);
        signal.emit(2);
        expect(await promise).toBe(1);
    });

    test("void signal works", () => {
        const signal = new Signal<void>();
        let called = false;
        signal.listen(() => {
            called = true;
        });
        signal.emit();
        expect(called).toBe(true);
    });
});
