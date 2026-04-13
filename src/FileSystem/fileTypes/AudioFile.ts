export class AudioFile {
  private url: string;
  private audio: HTMLAudioElement | undefined;

  public constructor(url: string) {
    this.url = url;
    this.audio = undefined;
  }

  public play() {
    if (!this.audio) {
      this.audio = new Audio(this.url);
    }
    this.audio.play();
  }

  public stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}
