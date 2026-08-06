import { PlayerInfo } from "@/models/account";
import { GameConfig } from "@/models/config";
import { InstanceSummary } from "@/models/instance/misc";
import { JavaInfo } from "@/models/misc";

export interface LaunchingState {
  id: number;
  currentStep: number;
  selectedJava: JavaInfo;
  selectedInstance: InstanceSummary;
  gameConfig: GameConfig;
  clientInfo: any;
  assetIndex: any;
  selectedPlayer?: PlayerInfo;
  authServerMeta: string;
  pid: number;
}
