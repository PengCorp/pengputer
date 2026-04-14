/*
 * A ring buffer implementation.
 *
 * It is used to store a fixed number of items, and when the buffer is full, the oldest item is discarded when a new item is pushed.
 */

export class RingBuffer<T> {
  /** Total number of slots for items. */
  private capacity: number;

  /** Implementation array holding items. */
  private items: (T | null)[];

  /** Next index in items array where item will be inserted. */
  private nextIdx: number;

  /** Number of items in the buffer. Less or eq to items array length. */
  private length: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = new Array(capacity).fill(null);
    this.nextIdx = 0;
    this.length = 0;
  }

  /** Shifts idx by provided delta. Always results in a valid index into items array. */
  private shiftIdx(idx: number, delta: number) {
    idx += delta;
    while (idx < 0) {
      idx += this.capacity;
    }
    while (idx >= this.capacity) {
      idx -= this.capacity;
    }
    return idx;
  }

  private getIdxFromOffset(offset: number) {
    return this.shiftIdx(this.nextIdx, -1 + offset);
  }

  /** Retrieve last item in buffer. */
  public peek() {
    return this.items[this.shiftIdx(this.nextIdx, -1)];
  }

  /** Remove and return last item in buffer. */
  public pop() {
    const newNext = this.shiftIdx(this.nextIdx, -1);
    const cell = this.items[newNext];
    this.items[newNext] = null;
    this.nextIdx = newNext;
    this.length = Math.max(this.length - 1, 0);
    return cell;
  }

  /** Add another item to the end of the buffer. */
  public push(item: T) {
    this.items[this.nextIdx] = item;
    this.nextIdx = this.shiftIdx(this.nextIdx, +1);
    this.length = Math.min(this.length + 1, this.capacity);
  }

  /** Adds item to start of buffer. If space available - expands buffer. Else last item is lost. */
  public unshift(item: T) {
    if (this.length < this.capacity) {
      const idx = this.shiftIdx(this.nextIdx, -this.length - 1);
      this.items[idx] = item;
      this.length += 1;
    } else {
      this.nextIdx = this.shiftIdx(this.nextIdx, -1);
      this.items[this.nextIdx] = item;
    }
  }

  /** Retrieve a contiguous array of items from buffer. 0 refers to last added item, -1 to previous last, etc. */
  public slice(
    start: number = -(this.length - 1),
    end: number = 0,
  ): (T | null)[] {
    start = Math.max(start, -(this.length - 1));
    end = Math.min(end, 0);

    if (end < start) {
      throw new Error("End cannot come before start");
    }

    const result = [];
    let offset = start;
    while (offset <= end) {
      const idx = this.getIdxFromOffset(offset);
      result.push(this.items[idx]);
      offset += 1;
    }
    return result;
  }

  public getLength() {
    return this.length;
  }

  public getCapacity() {
    return this.capacity;
  }

  public __getItems() {
    return this.items;
  }
}
