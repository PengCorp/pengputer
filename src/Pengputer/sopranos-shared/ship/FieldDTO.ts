import { assert, isNil } from "../std";
import { BooleanField } from "./BooleanField";
import { AppError } from "sopranos-shared/apps/AppError";

export interface ShipDTO {
  size: number;
  hitsLeft: number;
}

export interface CellDTO {
  /** Id of ship taking up the cell or null if no ship is taking up the cell. */
  shipId: number | null;

  /** Was the cell a target of a shot. */
  wasShot: boolean;
}

export interface FieldDTO {
  width: number;
  height: number;

  grid: Array<CellDTO>;
  ships: Record<number, ShipDTO>;
}

export const createFieldDTOFromBooleanField = (field: BooleanField) => {
  assert(
    field.getIsValid(),
    "Invalid boolean field found when creating Field.",
    AppError
  );

  const dto: FieldDTO = {
    width: field.width,
    height: field.height,
    grid: new Array(field.width * field.height).fill(null).map(() => ({
      shipId: null,
      wasShot: false,
    })),
    ships: {},
  };

  let nextShipId = 1;
  for (let y = 0; y < dto.height; y += 1) {
    for (let x = 0; x < dto.width; x += 1) {
      const index = y * dto.width + x;
      if (field.getCell(x, y) && isNil(dto.grid[index].shipId)) {
        const shipId = nextShipId;
        nextShipId += 1;

        fillInShipFromBooleanField(dto, field, shipId, x, y);
      }
    }
  }

  return dto;
};

/** Assumes a valid boolean field with properly formed ships. */
const fillInShipFromBooleanField = (
  dto: FieldDTO,
  field: BooleanField,
  shipId: number,
  x: number,
  y: number
) => {
  const cell = field.getCell(x, y);

  if (isNil(cell)) {
    return;
  }

  const index = y * dto.width + x;

  if (!isNil(dto.grid[index].shipId)) {
    return;
  }

  if (cell) {
    dto.grid[index].shipId = shipId;
    if (!dto.ships[shipId]) {
      dto.ships[shipId] = {
        size: 1,
        hitsLeft: 1,
      };
    } else {
      const ship = dto.ships[shipId];
      ship.size += 1;
      ship.hitsLeft += 1;
    }

    fillInShipFromBooleanField(dto, field, shipId, x + 1, y);
    fillInShipFromBooleanField(dto, field, shipId, x - 1, y);
    fillInShipFromBooleanField(dto, field, shipId, x, y + 1);
    fillInShipFromBooleanField(dto, field, shipId, x, y - 1);
  }
};
