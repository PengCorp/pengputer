export class RingBuffer<T> {
  private size: number;
  private items: (T | null)[];
  private idx: number;
  private length: number;

  constructor(size: number) {
    this.size = size;
    this.items = new Array(size).fill(null);
    this.idx = 0;
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
    return this.items[this.idx];
  }

  public pop() {
    const cell = this.items[this.idx];
    this.idx = this.moveIdx(this.idx, -1);
    this.length = Math.max(this.length - 1, 0);
    return cell;
  }

  public push(cell: T) {
    this.items[this.idx] = cell;
    this.idx = this.moveIdx(this.idx, +1);
    this.length = Math.min(this.length + 1, this.size);
  }

  public slice(start: number, end: number) {
    const result = [];
    let idx = this.idx;
    idx = this.moveIdx(idx, start);
    for (let i = start; i < end; i += 1) {
      result.push(this.items[idx]);
      idx = this.moveIdx(idx, +1);
    }
    return result;
  }

  public getLength() {
    return this.length;
  }

  public getSize() {
    return this.size;
  }
}
