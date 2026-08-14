export type LinkOpenType = "run" | "open";

export class LinkFile {
    private href: string;

    public constructor(href: string) {
        this.href = href;
    }

    public getURL(): string {
        return this.href;
    }

    public open() {
        window.open(this.href, "_blank");
    }
}
