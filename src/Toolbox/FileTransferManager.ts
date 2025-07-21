class FileTransferManager {
  static #actionInProgress: boolean = false;

  static #isUploadOpen: boolean = false;

  public static presentDownload(text: string, filename: string) {
    if (this.#actionInProgress) {
      throw new Error("FileTransferManager is busy.");
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

  public static askForUpload(
    extension: string = "flp",
    mime: string = "text/plain",
  ) {
    if (this.#actionInProgress) {
      throw new Error("FileTransferManager is busy.");
    }

    this.#actionInProgress = true;
    return new Promise<{ text: string; name: string }>((resolve, reject) => {
      this.#isUploadOpen = false;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = `.${extension}, ${mime}`;

      input.addEventListener("change", async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const text = await file.text();
          resolve({ text, name: file.name });
        }
      });

      const windowFocusListener = () => {
        if (this.#isUploadOpen) {
          setTimeout(() => {
            if (!input.files?.length) {
              reject();
            }
            window.removeEventListener("focus", windowFocusListener);
            this.#isUploadOpen = false;
          }, 500);
        }
      };
      window.addEventListener("focus", windowFocusListener);

      this.#isUploadOpen = true;
      input.click();
    }).finally(() => {
      this.#actionInProgress = false;
    });
  }
}

export { FileTransferManager };
