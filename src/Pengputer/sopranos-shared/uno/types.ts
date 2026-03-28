export type RoomClientState = {
  id: string | null;
  users: Record<string, { name: string }>;
};

export enum UnoCardSuit {
  RED,
  BLUE,
  GREEN,
  YELLOW,
  WILD,
}

export type UnoCardRegularSuit =
  | UnoCardSuit.RED
  | UnoCardSuit.BLUE
  | UnoCardSuit.GREEN
  | UnoCardSuit.YELLOW;

export enum UnoCardValue {
  ZERO,
  ONE,
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
  NINE,
  SKIP,
  DRAWTWO,
  REVERSE,
  WILD,
  WILDDRAWFOUR,
}

export interface UnoCard {
  suit: UnoCardSuit;
  value: UnoCardValue;
  wildSuit?: UnoCardRegularSuit;
}

export type GameState =
  | "waiting"
  | "pickSuit"
  | "playing"
  | "playOrKeep"
  | "roundOver";

export type SharedGamePlayerState = {
  id: string;
  isOwner: boolean;
  numberOfCardsHeld: number;
};

export type SharedGameState = {
  playerStates: Record<string, SharedGamePlayerState>;
  gameState: GameState;
  drawPileHeight: number;
  discardPileHeight: number;
  discardPileTopCards: UnoCard[];
  currentPlayer: string | null;
};

export type PlayerGameState = {
  id: string;
  isOwner: boolean;
  hand: UnoCard[];
};

export type ClientState = {
  id: string | null;
  room: RoomClientState | null;

  sharedState: SharedGameState | null;
  playerState: PlayerGameState | null;
};
