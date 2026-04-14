import { describe, expect, test } from "vitest";
import { RingBuffer } from "./RingBuffer";

describe("RingBuffer", () => {
  test("pushing", () => {
    const rb = new RingBuffer(5);

    rb.push(1);

    expect(rb.slice()).toStrictEqual([1]);

    rb.push(2);
    rb.push(3);
    rb.push(4);
    rb.push(5);

    expect(rb.slice()).toStrictEqual([1, 2, 3, 4, 5]);

    rb.push(6);
    rb.push(7);

    expect(rb.slice()).toStrictEqual([3, 4, 5, 6, 7]);
  });

  test("slicing", () => {
    const rb = new RingBuffer(5);
    rb.push(1);
    rb.push(2);
    rb.push(3);

    expect(rb.slice(-100, 5)).toStrictEqual([1, 2, 3]);
    expect(rb.slice(-1, 0)).toStrictEqual([2, 3]);
    expect(rb.slice(-100, -2)).toStrictEqual([1]);

    rb.push(4);
    rb.push(5);

    expect(rb.slice()).toStrictEqual([1, 2, 3, 4, 5]);
    expect(rb.slice(-100, 100)).toStrictEqual([1, 2, 3, 4, 5]);
    expect(rb.slice(-2, -1)).toStrictEqual([3, 4]);
    expect(rb.slice(-100, -4)).toStrictEqual([1]);
    expect(rb.slice(-2, 100)).toStrictEqual([3, 4, 5]);
    expect(rb.slice(0, 0)).toStrictEqual([5]);
  });

  test("unshift", () => {
    const rb = new RingBuffer(5);

    rb.push(1);
    rb.push(2);
    rb.unshift(3);

    expect(rb.slice()).toStrictEqual([3, 1, 2]);

    rb.unshift(4);
    rb.unshift(5);
    rb.unshift(6);

    expect(rb.slice()).toStrictEqual([6, 5, 4, 3, 1]);
  });

  test("pop", () => {
    const rb = new RingBuffer(3);

    rb.push(1);
    rb.push(2);
    rb.push(3);

    expect(rb.pop()).toBe(3);
    expect(rb.pop()).toBe(2);
    expect(rb.pop()).toBe(1);
    expect(rb.pop()).toBe(null);
  });

  test("peek", () => {
    const rb = new RingBuffer(3);

    expect(rb.peek()).toBe(null);

    rb.push(1);

    expect(rb.peek()).toBe(1);

    rb.push(2);
    rb.push(3);
    rb.push(4);

    expect(rb.peek()).toBe(4);
  });

  test("getCapacity", () => {
    const rb = new RingBuffer(3);

    expect(rb.getCapacity()).toBe(3);

    rb.push(1);

    expect(rb.getCapacity()).toBe(3);

    rb.push(2);
    rb.push(3);
    rb.push(4);

    expect(rb.getCapacity()).toBe(3);
  });

  test("getSize", () => {
    const rb = new RingBuffer(3);

    expect(rb.getLength()).toBe(0);

    rb.push(1);

    expect(rb.getLength()).toBe(1);

    rb.push(2);
    rb.push(3);
    rb.push(4);

    expect(rb.getLength()).toBe(3);
  });
});
