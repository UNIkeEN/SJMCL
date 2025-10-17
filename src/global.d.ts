export {};

declare global {
  interface Window {
    logger: {
      info: (...args: any[]) => Promise<void>;
      warn: (...args: any[]) => Promise<void>;
      error: (...args: any[]) => Promise<void>;
      debug: (...args: any[]) => Promise<void>;
      trace: (...args: any[]) => Promise<void>;
    };
  }

  const logger: Window["logger"];
}
