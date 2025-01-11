import { AuthServer } from "./auth_server";

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
