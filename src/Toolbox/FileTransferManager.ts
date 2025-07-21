class FileTransferManager {
  static #actionInProgress: boolean = false;

  public static presentDownload(text: string, filename: string) {
    if (this.#actionInProgress) {
      throw new Error("TextDrive is busy.");
    }

    this.#actionInProgress = true;
    return new Promise<void>((resolve, reject) => {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      resolve();
    }).finally(() => {
      this.#actionInProgress = false;
    });
  }

  public static askForUpload() {
    if (this.#actionInProgress) {
      throw new Error("TextDrive is busy.");
    }

    this.#actionInProgress = true;
    return new Promise<{ text: string; name: string }>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".flp, text/plain";
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const text = await file.text();
          resolve({ text, name: file.name });
        } else {
          reject();
        }
      };
      input.click();
    }).finally(() => {
      this.#actionInProgress = false;
    });
  }
}

export { FileTransferManager };
