export type SignalListener<D> = (data: D) => void;

export class Signal<D = void> {
  private listeners: Array<SignalListener<D>>;
  constructor() {
    this.listeners = [];
  }

  public listen(listener: SignalListener<D>) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (currentListener) => currentListener !== listener
      );
    };
  }

  public emit(data: D) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}
