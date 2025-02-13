// player
export interface Player {
  name: string;
  uuid: string;
  avatarSrc: string;
  playerType: "offline" | "microsoft" | "3rdparty";
  authServer?: AuthServer; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
  password?: string; // only from authlib-injector
}

// authlib-injector source
export interface AuthServer {
  // id: number;
  name: string;
  authUrl: string;
  homepageUrl: string;
  registerUrl: string;
  mutable: boolean;
  features: AuthServerFeatures;
}

export interface AuthServerFeatures {
  nonEmailLogin: boolean;
  openidConfigurationUrl: string;
}
