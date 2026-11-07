export interface WorldInfo {
  name: string;
  lastPlayedAt: number;
  difficulty?: string;
  gamemode: string;
  iconSrc: string;
  dirPath: string;
}

export type WorldDataValue =
  | string
  | number
  | WorldDataValue[]
  | { [key: string]: WorldDataValue };

export type WorldDetails = Record<string, WorldDataValue>;
