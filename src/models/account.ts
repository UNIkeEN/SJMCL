import { PlayerType } from "@/enums/account";

export enum PresetSkinType {
  Steve = "steve",
  Alex = "alex",
}

export interface Texture {
  textureType: string;
  image: string;
  model: "default" | "slim";
  preset?: PresetSkinType;
}

// player
export interface Player {
  id: string;
  name: string;
  uuid: string;
  avatar: string;
  playerType: PlayerType;
  authServer?: AuthServer; // only from authlib-injector
  authAccount?: string; // only from authlib-injector
  password?: string; // only from authlib-injector
  accessToken?: string; // only from authlib-injector or microsoft
  refreshToken?: string; // only from oauth login methods
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

export interface OAuthCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
}
