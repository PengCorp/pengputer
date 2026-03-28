export type RoomClientState = {
  id: string | null;
  users: Record<string, { name: string }>;
};

export type GameState = "waiting";

export type SharedGamePlayerState = {
  id: string;
  isOwner: boolean;
};

export type SharedGameState = {
  playerStates: Record<string, SharedGamePlayerState>;
  gameState: GameState;
  currentPlayer: string | null;
};

export type PlayerGameState = {
  id: string;
  isOwner: boolean;
};

export type ClientState = {
  id: string | null;
  room: RoomClientState | null;

  sharedState: SharedGameState | null;
  playerState: PlayerGameState | null;
};
