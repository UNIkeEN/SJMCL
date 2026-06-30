import type { ToastId, UseToastOptions } from "@chakra-ui/react";
import type React from "react";
import type { Player } from "@/models/account";
import type { LauncherConfig } from "@/models/config";
import type { InstanceSummary } from "@/models/instance/misc";
import type { logger as hostLogger } from "@/utils/logging";

export * from "./contribution";
export * from "./slot";

// static extension metadata
export interface ExtensionFrontend {
  entry: string;
}

export interface ExtensionInfo {
  identifier: string;
  name: string;
  description?: string | null;
  author?: string | null;
  version?: string | null;
  minimalLauncherVersion?: string | null;
  path: string;
  iconSrc: string;
  frontend?: ExtensionFrontend | null;
}

// reactive host data exposed to extension scripts.
export interface ExtensionAbilityData {
  config: LauncherConfig;
  selectedPlayer: Player | undefined;
  selectedInstance: InstanceSummary | undefined;
  playerList: Player[];
  instanceList: InstanceSummary[];
  routeQuery: Record<string, string | string[] | undefined>; // current route query parameters
}

// stable runtime abilities exposed by the host to extension scripts.
export interface ExtensionAbilityApi {
  actions: ExtensionAbilityActions;
  state: ExtensionAbilityState;
}

export interface ExtensionAbilityActions {
  // internal context-specific
  getPlayerList: (sync?: boolean) => Player[] | undefined;
  getInstanceList: (sync?: boolean) => InstanceSummary[] | undefined;
  updateConfig: (path: string, value: any) => void;
  // navigation and window management
  navigate: (route: string) => Promise<void>;
  navBack: () => void;
  openWindow: (route: string, title: string) => void;
  openExternalLink: (url: string) => Promise<void>;
  openSharedModal: (key: string, params?: any) => void;
  openCustomModal: (key: string, params?: any) => void;
  setHomeWidgetTitle: (title: string, key?: string) => void;
  // file system and request
  readFile: (path: string, mode?: "string" | "base64") => Promise<string>;
  writeFile: (
    path: string,
    content: string,
    mode?: "string" | "base64"
  ) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  deleteDirectory: (path: string) => Promise<void>;
  request: (
    input: URL | Request | string,
    init?: RequestInit
  ) => Promise<Response>;
  requestText: (
    url: string,
    init?: RequestInit,
    encoding?: string
  ) => Promise<string>;
  // general invoke for the launcher commands
  invoke: <T = unknown>(
    command: string,
    payload?: Record<string, unknown>
  ) => Promise<T>;
  // misc
  toast: (options: UseToastOptions) => ToastId;
  logger: typeof hostLogger;
  reloadSelf: () => void;
  updateSelf: (src: string, newVersion: string) => Promise<void>;
}

export interface ExtensionAbilityState {
  useExtensionState: <T>(
    key: string,
    initialValue: T
  ) => [T, React.Dispatch<React.SetStateAction<T>>];
}

// persisted extension data stored in launcher config.
export type HomeWidgetStateTuple = [string, number, boolean];
