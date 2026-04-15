import { loadImageBitmapFromUrl } from "@Toolbox/loadImage";

export class ImageFile {
    private src: string;
    private bitmap: ImageBitmap | undefined;

    public constructor(src: string) {
        this.src = src;
        this.bitmap = undefined;
    }

    public async load() {
        if (this.bitmap) {
            return this.bitmap;
        }

        this.bitmap = await loadImageBitmapFromUrl(this.src);
        return this.bitmap;
    }
}
