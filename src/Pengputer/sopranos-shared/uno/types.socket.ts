import { ClientState, UnoCardRegularSuit, UnoCardSuit } from "./types";

export interface ClientEmitEvents {
  "user:auth": (userId: string | null, secret: string | null) => void;

  "room:create": (user: { name: string }) => void;
  "room:join": (roomId: string, user: { name: string }) => void;

  "game:start": () => void;
  "game:skipPlayer": () => void;
  "game:placeCard": (cardIndex: number) => void;
  "game:pickSuit": (suit: UnoCardRegularSuit) => void;
  "game:drawCard": () => void;
  "game:keepDrawnCard": () => void;
  "game:playDrawnCard": () => void;
}

export interface ServerEmitEvents {
  "user:setId": (newUserId: string, newSecret: string) => void;
  "user:clearId": () => void;

  "state:update": (newState: ClientState) => void;
  "error:show": (error: string) => void;
}
