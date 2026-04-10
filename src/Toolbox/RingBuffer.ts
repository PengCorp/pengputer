/*
 * A ring buffer implementation.
 *
 * It is used to store a fixed number of items, and when the buffer is full, the oldest item is discarded when a new item is pushed.
 */

export class RingBuffer<T> {
  /** Total number of slots for items. */
  private size: number;

  /** Implementation array holding items. */
  private items: (T | null)[];

  /** Next index in items array where item will be inserted. */
  private nextIdx: number;

  /** Number of items in the buffer. Less or eq to items array length. */
  private length: number;

  constructor(size: number) {
    this.size = size;
    this.items = new Array(size).fill(null);
    this.nextIdx = 0;
    this.length = 0;
  }

  /** Shifts idx by provided delta. Always results in a valid index into items array. */
  private shiftIdx(idx: number, delta: number) {
    idx += delta;
    while (idx < 0) {
      idx += this.size;
    }
    while (idx >= this.size) {
      idx -= this.size;
    }
    return idx;
  }

  /** Retrieve last item in buffer. */
  public peek() {
    return this.items[this.nextIdx];
  }

  /** Remove and return last item in buffer. */
  public pop() {
    const cell = this.items[this.nextIdx];
    this.nextIdx = this.shiftIdx(this.nextIdx, -1);
    this.length = Math.max(this.length - 1, 0);
    return cell;
  }

  /** Add another item to the end of the buffer. */
  public push(item: T) {
    this.items[this.nextIdx] = item;
    this.nextIdx = this.shiftIdx(this.nextIdx, +1);
    this.length = Math.min(this.length + 1, this.size);
  }

  /** Adds item to start of buffer, shifts rest of items right. Last item is lost. */
  public unshift(item: T) {
    this.insertShiftRight(-(this.length - 1), item);
  }

  /** Retrieve a contiguous array of items from buffer. 0 refers to last added item, -1 to previous last, etc. */
  public slice(start: number, end: number): (T | null)[] {
    const result = [];
    let idx = this.nextIdx;
    idx = this.shiftIdx(idx, start);
    for (let i = start; i < end; i += 1) {
      result.push(this.items[idx]);
      idx = this.shiftIdx(idx, +1);
    }
    return result;
  }

  /** Inserts item at the provided offset from the last item. 0 refers to the last item. Following items are shifted right. Newest item is lost. */
  public insertShiftRight(offset: number, item: T) {
    if (offset > 0 || offset < -(this.size - 1)) {
      throw new Error(`Cannot insert to ring buffer at index ${offset}`);
    }

    let leftToShift = 0 - offset;
    let currentIdx = this.shiftIdx(this.nextIdx, -1 + offset);
    let savedItem: T | null = item;

    while (leftToShift > 0) {
      let removed = this.items[currentIdx];
      this.items[currentIdx] = savedItem;
      savedItem = removed;

      leftToShift -= 1;
      currentIdx = this.shiftIdx(currentIdx, 1);
    }
    this.items[currentIdx] = savedItem;
  }

  /** Inserts item at the provided offset from the last item. 0 refers to the last item. Preceeding items are shifted left. Oldest item is lost. */
  public insertShiftLeft(offset: number, item: T) {
    if (offset > 0 || offset < -(this.size - 1)) {
      throw new Error(`Cannot insert to ring buffer at index ${offset}`);
    }

    let leftToShift = this.length + offset - 1;
    let currentIdx = this.shiftIdx(this.nextIdx, -1 + offset);
    let savedItem: T | null = item;

    while (leftToShift > 0) {
      let removed = this.items[currentIdx];
      this.items[currentIdx] = savedItem;
      savedItem = removed;

      leftToShift -= 1;
      currentIdx = this.shiftIdx(currentIdx, -1);
    }
    this.items[currentIdx] = savedItem;
  }

  public getLength() {
    return this.length;
  }

  public getSize() {
    return this.size;
  }

  public __log() {
    console.log(this.items);
  }
}
