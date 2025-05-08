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
