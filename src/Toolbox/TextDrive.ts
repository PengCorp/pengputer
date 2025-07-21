class TextDrive {
  private actionInProgress: boolean = false;

  private container: HTMLElement;

  private clear(): void {
    this.container.innerHTML = "";
  }

  constructor(container: HTMLElement) {
    this.container = container;
  }

  presentDownload(text: string, filename: string) {
    if (this.actionInProgress) {
      throw new Error("TextDrive is busy.");
    }

    this.actionInProgress = true;
    return new Promise<void>((resolve, reject) => {
      const downloadButton = document.createElement("button");
      downloadButton.textContent = "Download";
      downloadButton.onclick = () => {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        resolve();
      };
      this.container.appendChild(downloadButton);

      const closeButton = document.createElement("button");
      closeButton.textContent = "Cancel";
      closeButton.onclick = () => {
        reject();
      };
      this.container.appendChild(closeButton);
    }).finally(() => {
      this.clear();
      this.actionInProgress = false;
    });
  }

  askForUpload() {
    if (this.actionInProgress) {
      throw new Error("TextDrive is busy.");
    }

    this.actionInProgress = true;
    return new Promise<{ text: string; name: string }>((resolve, reject) => {
      const uploadButton = document.createElement("button");
      uploadButton.textContent = "Upload";
      uploadButton.onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".flp, text/plain";
        input.onchange = async (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            const text = await file.text();
            resolve({ text, name: file.name });
          }
        };
        input.click();
      };
      this.container.appendChild(uploadButton);

      const closeButton = document.createElement("button");
      closeButton.textContent = "Cancel";
      closeButton.onclick = () => {
        reject();
      };
      this.container.appendChild(closeButton);
    }).finally(() => {
      this.clear();
      this.actionInProgress = false;
    });
  }
}

export const textDrive = new TextDrive(document.querySelector("#text-drive")!);

// (async () => {
//   try {
//     await textDrive.presentDownload("{ anything: 42 }", "untitled.flp");
//   } catch (e) {
//     console.error(e);
//   }
//   try {
//     console.log(await textDrive.askForUpload());
//   } catch (e) {
//     console.error(e);
//   }
// })();
