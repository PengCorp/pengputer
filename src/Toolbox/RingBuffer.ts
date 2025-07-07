export class RingBuffer<T> {
  private size: number;
  private items: (T | null)[];
  private nextIdx: number;
  private length: number;

  constructor(size: number) {
    this.size = size;
    this.items = new Array(size).fill(null);
    this.nextIdx = 0;
    this.length = 0;
  }

  private moveIdx(idx: number, delta: number) {
    idx += delta;
    while (idx < 0) {
      idx += this.size;
    }
    while (idx >= this.size) {
      idx -= this.size;
    }
    return idx;
  }

  public peek() {
    return this.items[this.nextIdx];
  }

  public pop() {
    const cell = this.items[this.nextIdx];
    this.nextIdx = this.moveIdx(this.nextIdx, -1);
    this.length = Math.max(this.length - 1, 0);
    return cell;
  }

  public push(item: T) {
    this.items[this.nextIdx] = item;
    this.nextIdx = this.moveIdx(this.nextIdx, +1);
    this.length = Math.min(this.length + 1, this.size);
  }

  public slice(start: number, end: number): (T | null)[] {
    const result = [];
    let idx = this.nextIdx;
    idx = this.moveIdx(idx, start);
    for (let i = start; i < end; i += 1) {
      result.push(this.items[idx]);
      idx = this.moveIdx(idx, +1);
    }
    return result;
  }

  /** Inserts element at the provided offset from the last element. 0 refers to the last element. Following elements are shifted right. Newest element is lost. */
  public insertAtWithDiscard(offset: number, item: T) {
    if (offset > 0 || offset < -(this.size - 1)) {
      throw new Error(`Cannot insert to ring buffer at index ${offset}`);
    }

    let offsetIdx = offset;
    let idx = this.moveIdx(this.nextIdx - 1, offset);

    let nextItem = this.items[idx];
    this.items[idx] = item;
    if (offsetIdx < 0) {
      for (; (offsetIdx += 1), (idx = this.moveIdx(idx, 1)), offsetIdx < 0; ) {
        let removedItem = this.items[idx];
        this.items[idx] = nextItem;
        nextItem = removedItem;
      }
      this.items[idx] = nextItem;
    }
  }

  public getLength() {
    return this.length;
  }

  public getSize() {
    return this.size;
  }
}
