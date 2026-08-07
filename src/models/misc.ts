import type { WebviewOptions } from "@tauri-apps/api/webview";
import type { WindowOptions } from "@tauri-apps/api/window";

export interface WindowConfig
  extends Omit<WebviewOptions, "x" | "y" | "width" | "height">, WindowOptions {
  label: string;
}

export interface JavaInfo {
  name: string;
  execPath: string;
  vendor: string;
  majorVersion: number;
  isLts: boolean;
  isUserAdded: boolean;
}

export interface MemoryInfo {
  total: number;
  used: number;
  suggestedMaxAlloc: number;
}
