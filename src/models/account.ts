import { PlayerType, PresetRole, SkinModel } from "@/enums/account";

export interface Texture {
  textureType: string;
  image: string;
  model: SkinModel;
  preset?: PresetRole;
}

// player (frontend display format)
export interface Player {
  id: string;
  name: string;
  uuid: string;
  avatar: Array<string>; // [face, hat]
  playerType: PlayerType;
  authServer?: AuthServer; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
  password?: string; // only from authlib-injector
  accessToken?: string; // only from authlib-injector or microsoft
  refreshToken?: string; // only from oauth login methods
  textures: Array<Texture>;
}

// player (backend storage format)
export interface PlayerInfo {
  id: string;
  name: string;
  uuid: string;
  playerType: PlayerType;
  authAccount: string;
  password: string;
  authServerUrl: string;
  accessToken: string;
  refreshToken: string;
  textures: Array<Texture>;
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
  clientId: string;
}

export interface AuthServerFeatures {
  nonEmailLogin: boolean;
  openidConfigurationUrl: string;
}

export interface DeviceAuthResponseInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval?: number;
  expiresIn: number;
}
