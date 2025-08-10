import { isDriveLabel, PATH_SEPARATOR, type DriveLabel } from "./constants";

export class FilePath {
  static tryParse(
    path: string,
    defaultDrive: DriveLabel | null = null,
  ): FilePath | null {
    if (path.length === 0) return new FilePath(null, [], false);
    if (path === "/") return new FilePath(null, [], true);

    let drive: DriveLabel | null = null;

    const colonIndex = path.indexOf(":");
    if (colonIndex >= 0) {
      const driveName = path.slice(0, colonIndex).toUpperCase();
      // TODO(local): file info parse error
      if (!isDriveLabel(driveName)) return null;
      drive = driveName;

      path = path.slice(colonIndex + 1);
    }

    const isAbsolute = path.length === 0 || path[0] === "/";
    if (isAbsolute) {
      path = path.slice(1);
      if (drive === null) drive = defaultDrive;
    }

    const pieces = path.split("/").filter((s) => s.length > 0);
    return new FilePath(drive, pieces, isAbsolute);
  }

  #drive: DriveLabel | null;
  #pieces: string[];
  #isAbsolute: boolean;

  private constructor(
    drive: DriveLabel | null,
    pieces: string[],
    isAbsolute: boolean,
  ) {
    isAbsolute = drive !== null || isAbsolute;

    this.#drive = drive;
    this.#isAbsolute = isAbsolute;

    this.#pieces = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];

      if (piece === "..") {
        if (isAbsolute) {
          if (this.#pieces.length !== 0) this.#pieces.pop();
        } else this.#pieces.push("..");
      } else if (piece === ".") {
        continue;
      } else this.#pieces.push(piece);
    }
  }

  get drive(): DriveLabel | null {
    return this.#drive;
  }

  get pieces(): readonly string[] {
    return [...this.#pieces];
  }

  hasDrive() {
    return this.drive !== null;
  }

  isAbsolute() {
    return this.#isAbsolute;
  }

  isRelative() {
    return !this.#isAbsolute;
  }

  equals(other: FilePath): boolean {
    if (this.drive !== other.drive) {
      return false;
    }

    const thisPieces = this.#pieces;
    const otherPieces = other.#pieces;
    if (thisPieces.length !== otherPieces.length) {
      return false;
    }

    for (let i = 0; i < thisPieces.length; i++) {
      if (thisPieces[i] !== otherPieces[i]) {
        return false;
      }
    }

    return true;
  }

  combine(other: FilePath) {
    if (other.isAbsolute()) return this;
    return new FilePath(
      this.#drive,
      [...this.#pieces, ...other.#pieces],
      this.#isAbsolute,
    );
  }

  toString() {
    const pathPart = this.#pieces.join(PATH_SEPARATOR);
    if (this.drive !== null) {
      return `${this.drive}:${PATH_SEPARATOR}${pathPart}`;
    } else if (this.#isAbsolute) {
      return `${PATH_SEPARATOR}${pathPart}`;
    } else return `.${PATH_SEPARATOR}${pathPart}`;
  }

  parentDirectory() {
    const pieces = this.#pieces;
    if (pieces.length === 0) return this;
    return new FilePath(
      this.#drive,
      pieces.slice(0, pieces.length - 1),
      this.#isAbsolute,
    );
  }
}
