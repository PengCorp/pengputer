class FileTransferManager {
    private static _actionInProgress: boolean = false;

    private static _isUploadOpen: boolean = false;

    public static presentDownload(text: string, filename: string) {
        if (this._actionInProgress) {
            throw new Error("FileTransferManager is busy.");
        }

        this._actionInProgress = true;
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
            this._actionInProgress = false;
        });
    }

    public static askForUpload(
        extension: string = "flp",
        mime: string = "text/plain",
    ) {
        if (this._actionInProgress) {
            throw new Error("FileTransferManager is busy.");
        }

        this._actionInProgress = true;
        return new Promise<{ text: string; name: string }>(
            (resolve, reject) => {
                this._isUploadOpen = false;

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
                    if (this._isUploadOpen) {
                        setTimeout(() => {
                            if (!input.files?.length) {
                                reject();
                            }
                            window.removeEventListener(
                                "focus",
                                windowFocusListener,
                            );
                            this._isUploadOpen = false;
                        }, 500);
                    }
                };
                window.addEventListener("focus", windowFocusListener);

                this._isUploadOpen = true;
                input.click();
            },
        ).finally(() => {
            this._actionInProgress = false;
        });
    }
}

export { FileTransferManager };
