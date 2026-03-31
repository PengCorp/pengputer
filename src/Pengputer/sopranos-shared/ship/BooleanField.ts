export class BooleanField {
  public grid: Array<boolean>;
  public width: number;
  public height: number;

  constructor(grid: Array<boolean>, width: number, height: number) {
    this.grid = grid;
    this.width = width;
    this.height = height;
  }

  public getCell(x: number, y: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }

    return this.grid[y * this.width + x];
  }

  public getIsValid() {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (!this.getCell(x, y)) {
          continue;
        }

        // if any filled cell is adjacent diagonally
        if (
          this.getCell(x + 1, y + 1) ||
          this.getCell(x - 1, y - 1) ||
          this.getCell(x + 1, y - 1) ||
          this.getCell(x - 1, y + 1)
        ) {
          return false;
        }

        // adjacent horizontally but also has a cell adjacent vertically
        if (this.getCell(x + 1, y) || this.getCell(x - 1, y)) {
          if (this.getCell(x, y - 1) || this.getCell(x, y + 1)) {
            return false;
          }
        }

        // adjacent vertically but also has a cell adjacent horizontally
        if (this.getCell(x, y - 1) || this.getCell(x, y + 1)) {
          if (this.getCell(x - 1, y) || this.getCell(x + 1, y)) {
            return false;
          }
        }
      }
    }

    return true;
  }
}
