export {};

declare global {
  interface Window {
    log: {
      info: (...args: any[]) => Promise<void>;
      warn: (...args: any[]) => Promise<void>;
      error: (...args: any[]) => Promise<void>;
      debug: (...args: any[]) => Promise<void>;
      trace: (...args: any[]) => Promise<void>;
    };
  }

  const log: Window["log"];
}
