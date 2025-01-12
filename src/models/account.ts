// player
export interface Player {
  name: string;
  uuid: string;
  avatarSrc: string;
  playerType: "offline" | "3rdparty";
  authServer?: AuthServer; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
  password?: string; // only from authlib-injector
}

// player info upload to / receive from the server
export interface PlayerInfo {
  name: string;
  uuid: string;
  avatarSrc: string;
  playerType: "offline" | "3rdparty";
  authServerUrl: string; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
  password?: string; // only from authlib-injector
}

// authlib-injector source
export interface AuthServer {
  // id: number;
  name: string;
  authUrl: string;
  mutable: boolean;
}

export enum AuthServerError {
  DUPLICATE_SERVER = "DUPLICATE_SERVER",
  INVALID_SERVER = "INVALID_SERVER",
  NOT_FOUND = "NOT_FOUND",
}
