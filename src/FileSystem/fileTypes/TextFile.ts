export class TextFile {
  private data: string;

  public constructor() {
    this.data = "";
  }

  public getText() {
    return this.data;
  }

  public append(text: string) {
    this.data = `${this.data}${text}`;
  }

  public replace(text: string) {
    this.data = text;
  }
}
