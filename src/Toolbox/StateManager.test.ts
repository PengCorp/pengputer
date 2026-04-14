import { describe, expect, test } from "vitest";
import { State, StateManager } from "./StateManager";

class TestState extends State {
  log: string[] = [];
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  override onEnter() {
    this.log.push("enter");
  }
  override onFocus() {
    super.onFocus();
    this.log.push("focus");
  }
  override onBlur() {
    super.onBlur();
    this.log.push("blur");
  }
  override onLeave() {
    this.log.push("leave");
  }
  override update(dt: number) {
    this.log.push(`update:${dt}`);
  }
}

describe("StateManager", () => {
  test("starts empty", () => {
    const sm = new StateManager();
    expect(sm.getIsEmpty()).toBe(true);
    expect(sm.getTopState()).toBeNull();
    expect(sm.getStackLength()).toBe(0);
  });

  test("push calls onEnter then onFocus", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    sm.pushState(a);
    expect(a.log).toStrictEqual(["enter", "focus"]);
    expect(sm.getTopState()).toBe(a);
    expect(sm.getStackLength()).toBe(1);
  });

  test("push blurs previous top", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");
    sm.pushState(a);
    a.log.length = 0;

    sm.pushState(b);
    expect(a.log).toStrictEqual(["blur"]);
    expect(b.log).toStrictEqual(["enter", "focus"]);
    expect(sm.getTopState()).toBe(b);
  });

  test("pop lifecycle and reveals previous state", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");
    sm.pushState(a);
    sm.pushState(b);
    a.log.length = 0;
    b.log.length = 0;

    sm.popState();
    expect(b.log).toStrictEqual(["blur", "leave"]);
    expect(a.log).toStrictEqual(["focus"]);
    expect(sm.getTopState()).toBe(a);
    expect(sm.getStackLength()).toBe(1);
  });

  test("pop empty stack throws", () => {
    const sm = new StateManager();
    expect(() => sm.popState()).toThrow("No state to pop");
  });

  test("replace lifecycle", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");
    sm.pushState(a);
    a.log.length = 0;

    sm.replaceState(b);
    expect(a.log).toStrictEqual(["blur", "leave"]);
    expect(b.log).toStrictEqual(["enter", "focus"]);
    expect(sm.getTopState()).toBe(b);
    expect(sm.getStackLength()).toBe(1);
  });

  test("replace on empty stack acts like push", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    sm.replaceState(a);
    expect(a.log).toStrictEqual(["enter", "focus"]);
    expect(sm.getStackLength()).toBe(1);
  });

  test("popAllStates tears down in order", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");
    sm.pushState(a);
    sm.pushState(b);
    a.log.length = 0;
    b.log.length = 0;

    sm.popAllStates();
    // b is popped first: blur, leave. Then a gets focus (revealed), then a is popped: blur, leave.
    expect(b.log).toStrictEqual(["blur", "leave"]);
    expect(a.log).toStrictEqual(["focus", "blur", "leave"]);
    expect(sm.getIsEmpty()).toBe(true);
  });

  test("update propagates to all states", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");
    sm.pushState(a);
    sm.pushState(b);
    a.log.length = 0;
    b.log.length = 0;

    sm.update(16);
    // iterates top-down (highest index first)
    expect(b.log).toStrictEqual(["update:16"]);
    expect(a.log).toStrictEqual(["update:16"]);
  });

  test("isFocused tracks focus state", () => {
    const sm = new StateManager();
    const a = new TestState("a");
    const b = new TestState("b");

    sm.pushState(a);
    expect(a["getIsFocused"]()).toBe(true);

    sm.pushState(b);
    expect(a["getIsFocused"]()).toBe(false);
    expect(b["getIsFocused"]()).toBe(true);

    sm.popState();
    expect(a["getIsFocused"]()).toBe(true);
  });
});
