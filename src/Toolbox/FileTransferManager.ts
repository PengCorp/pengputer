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

  public static askForUpload(
    extension: string = "flp",
    mime: string = "text/plain",
  ) {
    if (this.#actionInProgress) {
      throw new Error("TextDrive is busy.");
    }

    this.#actionInProgress = true;
    return new Promise<{ text: string; name: string }>((resolve, reject) => {
      let dialogOpen = false;

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
        if (dialogOpen) {
          setTimeout(() => {
            if (!input.files?.length) {
              reject();
            }
            window.removeEventListener("focus", windowFocusListener);
            dialogOpen = false;
          }, 500);
        }
      };
      window.addEventListener("focus", windowFocusListener);

      input.click();
      dialogOpen = true;
    }).finally(() => {
      this.#actionInProgress = false;
    });
  }
}

export { FileTransferManager };
