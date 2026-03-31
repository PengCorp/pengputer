import { assert } from "../std";
import { AppError } from "sopranos-shared/apps/AppError";
import { FieldDTO } from "./FieldDTO";

export interface Ship {
  size: number;
  hitsLeft: number;
}

export interface Cell {
  /** Id of ship taking up the cell or null if no ship is taking up the cell. */
  shipId: number | null;

  /** Was the cell a target of a shot. */
  wasShot: boolean;
}

export class Field {
  private width: number;
  private height: number;

  private grid: Array<Cell>;
  private ships: Record<number, Ship>;

  constructor(dto: FieldDTO) {
    this.width = dto.width;
    this.height = dto.height;

    this.grid = dto.grid;
    this.ships = dto.ships;

    assert(
      this.grid.length === this.width * this.height,
      "Grid doesn't match dimensions",
      AppError
    );
  }
}
