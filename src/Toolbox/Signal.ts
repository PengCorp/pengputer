export type SignalListener<D> = (data: D) => void;
export type SignalUnsubscribe = () => void;

export class Signal<D = void> {
  private listeners: Array<SignalListener<D>>;
  constructor() {
    this.listeners = [];
  }

  public listen(listener: SignalListener<D>): SignalUnsubscribe {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (currentListener) => currentListener !== listener,
      );
    };
  }

  public listenOnce(listener: SignalListener<D>) {
    const unsub = this.listen((data) => {
      unsub();
      listener(data);
    });
  }

  public emit(data: D) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  /** Returns a promise that resolves with signal value as soon as one is emitted. */
  public getPromise(): Promise<D> {
    return new Promise((resolve) => {
      this.listenOnce(resolve);
    });
  }
}
