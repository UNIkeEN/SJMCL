// player
export interface Player {
  id: number;
  name: string;
  uuid: string;
  avatarSrc: string;
  type: "offline" | "3rdparty";
  authServer?: AuthServer; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
}

// authlib-injector source
export interface AuthServer {
  // id: number;
  name: string;
  authUrl: string;
}
