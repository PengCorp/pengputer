export type GameState = "waiting" | "guessing";

export type SharedGamePlayerState = {
  id: string;
  hasVoted: boolean;
  hasBet: boolean;
  tokens: number;
  isOwner: boolean;
  lastTokensChange: number | null;
  timesAnswered: number;
};

export type SharedGameState = {
  question: string | null;
  options: string[] | null;
  playerStates: Record<string, SharedGamePlayerState>;
  answeringPlayer: string | null;
  tableTokens: number;
  gameState: GameState;
};

export type PlayerGameState = {
  id: string;
  vote: number | null;
  bet: number | null;
  tokens: number;
  isOwner: boolean;
};

export type RoomClientState = {
  id: string | null;
  users: Record<string, { name: string }>;
};

export type ClientState = {
  id: string | null;
  room: RoomClientState | null;

  sharedState: SharedGameState | null;
  playerState: PlayerGameState | null;
};

export interface ServerEmitEvents {
  "user:setId": (newUserId: string, newSecret: string) => void;
  "user:clearId": () => void;

  "state:update": (newState: ClientState) => void;
  "error:show": (error: string) => void;
}

export interface ClientEmitEvents {
  "user:auth": (userId: string | null, secret: string | null) => void;

  "room:create": (user: { name: string }) => void;
  "room:join": (roomId: string, user: { name: string }) => void;

  "game:setQuestion": (questionText: string, options: string[]) => void;
  "game:setAnsweringPlayer": (player: string) => void;
  "game:startGuessing": () => void;
  "game:resetQuestion": () => void;
  "game:setVote": (vote: number) => void;
  "game:setBet": (bet: number) => void;
  "game:completeQuestion": () => void;
}
