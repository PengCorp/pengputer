import { isDriveLetter, PATH_SEPARATOR, type DriveLetter } from "./constants";

function collapseSegments(segments: string[], absolute: boolean): string[] {
    const collapsed: string[] = [];

    for (const segment of segments) {
        if (segment.length === 0 || segment === ".") continue;

        if (segment === "..") {
            if (absolute) {
                if (collapsed.length > 0) collapsed.pop();
            } else {
                collapsed.push(segment);
            }
            continue;
        }

        collapsed.push(segment);
    }

    return collapsed;
}

export class FilePath {
    // TODO: paths `C:test/` and `C:test` parse into the same thing, which loses context
    //       distunguishing references to directories vs. files in the specified path.
    static tryParse(
        input: string,
        defaultDrive: DriveLetter | null = null,
    ): FilePath | null {
        let rest = input;
        let drive: DriveLetter | null = null;

        const colonIndex = rest.indexOf(":");
        if (colonIndex >= 0) {
            const label = rest.slice(0, colonIndex).toUpperCase();
            if (!isDriveLetter(label)) return null;

            drive = label;
            rest = rest.slice(colonIndex + 1);
        }

        const rooted =
            (drive !== null && rest.length === 0) ||
            rest.startsWith(PATH_SEPARATOR);
        if (rest.startsWith(PATH_SEPARATOR)) rest = rest.slice(1);
        if (rooted && drive === null) drive = defaultDrive;

        const segments = rest.length === 0 ? [] : rest.split(PATH_SEPARATOR);
        return new FilePath(drive, segments, rooted);
    }

    #drive: DriveLetter | null;
    #segments: readonly string[];
    #absolute: boolean;

    private constructor(
        drive: DriveLetter | null,
        segments: string[],
        absolute: boolean,
    ) {
        this.#drive = drive;
        this.#absolute = absolute || drive !== null;
        this.#segments = collapseSegments(segments, this.#absolute);
    }

    get drive(): DriveLetter | null {
        return this.#drive;
    }

    get pieces(): readonly string[] {
        return [...this.#segments];
    }

    hasDrive(): boolean {
        return this.#drive !== null;
    }

    isAbsolute(): boolean {
        return this.#absolute;
    }

    isRelative(): boolean {
        return !this.#absolute;
    }

    equals(other: FilePath): boolean {
        if (this.#drive !== other.#drive) return false;
        if (this.#absolute !== other.#absolute) return false;
        if (this.#segments.length !== other.#segments.length) return false;

        return this.#segments.every(
            (segment, index) => segment === other.#segments[index],
        );
    }

    combine(other: FilePath): FilePath {
        if (other.isAbsolute()) return other;
        return new FilePath(
            this.#drive,
            [...this.#segments, ...other.#segments],
            this.#absolute,
        );
    }

    parentDirectory(): FilePath {
        if (this.#segments.length === 0) return this;
        return new FilePath(
            this.#drive,
            this.#segments.slice(0, -1),
            this.#absolute,
        );
    }

    toString(): string {
        const tail = this.#segments.join(PATH_SEPARATOR);
        if (this.#drive !== null) {
            return `${this.#drive}:${PATH_SEPARATOR}${tail}`;
        }
        if (this.#absolute) {
            return `${PATH_SEPARATOR}${tail}`;
        }
        return `.${PATH_SEPARATOR}${tail}`;
    }
}
