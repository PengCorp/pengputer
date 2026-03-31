import { isNil } from "../std";
import { UnoCard, UnoCardSuit } from "./types";

const regularSuits: UnoCardSuit[] = [
  UnoCardSuit.BLUE,
  UnoCardSuit.GREEN,
  UnoCardSuit.RED,
  UnoCardSuit.YELLOW,
];

export const canPlaceCardOnCard = (a: UnoCard, b: UnoCard) => {
  if (regularSuits.includes(a.suit) && regularSuits.includes(b.suit)) {
    if (a.value === b.value) return true;
    if (a.suit === b.suit) return true;
  }

  if (a.suit === UnoCardSuit.WILD) return true;

  if (b.suit === UnoCardSuit.WILD) {
    if (isNil(b.wildSuit)) return false;
    if (a.suit === b.wildSuit) return true;
  }

  return false;
};
