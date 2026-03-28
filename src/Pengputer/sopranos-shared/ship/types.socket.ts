import { ClientState } from "./types";

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
}
