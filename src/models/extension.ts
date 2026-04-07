import type React from "react";
import type { Player } from "@/models/account";
import type { LauncherConfig } from "@/models/config";
import type { InstanceSummary } from "@/models/instance/misc";

// static extension metadata
export interface ExtensionFrontend {
  entry: string;
}

export interface ExtensionInfo {
  identifier: string;
  name: string;
  description?: string | null;
  version?: string | null;
  minimalLauncherVersion?: string | null;
  path: string;
  iconSrc: string;
  frontend?: ExtensionFrontend | null;
}

// runtime abilities exposed by the host to extension scripts.
export interface ExtensionAbility {
  data: ExtensionAbilityData;
  actions: ExtensionAbilityActions;
  state: ExtensionAbilityState;
}

export interface ExtensionAbilityData {
  config: LauncherConfig;
  selectedPlayer: Player | undefined;
  selectedInstance: InstanceSummary | undefined;
  playerList: Player[];
  instanceList: InstanceSummary[];
  routeQuery: Record<string, string | string[] | undefined>; // current route query parameters
}

export interface ExtensionAbilityActions {
  getPlayerList: (sync?: boolean) => Player[] | undefined;
  getInstanceList: (sync?: boolean) => InstanceSummary[] | undefined;
  updateConfig: (path: string, value: any) => void;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  deleteDirectory: (path: string) => Promise<void>;
  invoke: <T = unknown>(
    command: string,
    payload?: Record<string, unknown>
  ) => Promise<T>;
  requestText: (
    url: string,
    init?: RequestInit,
    encoding?: string
  ) => Promise<string>;
  openSharedModal: (key: string, params?: any) => void;
  reloadSelf: () => void;
}

export interface ExtensionAbilityState {
  useExtensionState: <T>(
    key: string,
    initialValue: T
  ) => [T, React.Dispatch<React.SetStateAction<T>>];
}

// extension-declared contract (raw declaration from plugin).
export interface ExtensionHomeWidgetDefinition {
  key?: string;
  title: string;
  description?: string;
  icon?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  Component: React.ComponentType;
}

export interface ExtensionSettingsPageDefinition {
  Component: React.ComponentType;
}

// host-bound contribution (definition + extension metadata).
export interface ExtensionHomeWidgetContribution extends ExtensionHomeWidgetDefinition {
  identifier: string;
  resetKey: string;
  extension: ExtensionInfo;
}

export interface ExtensionSettingsPageContribution extends ExtensionSettingsPageDefinition {
  identifier: string;
  resetKey: string;
  extension: ExtensionInfo;
}
