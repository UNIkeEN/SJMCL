import { debug, error, info, trace, warn } from "@tauri-apps/plugin-log";

function formatArg(arg: any): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
  if (typeof arg === "object") return JSON.stringify(arg);
  return String(arg);
}

export const logger = {
  info: async (...args: any[]) => info(args.map(formatArg).join(" ")),
  warn: async (...args: any[]) => warn(args.map(formatArg).join(" ")),
  error: async (...args: any[]) => error(args.map(formatArg).join(" ")),
  debug: async (...args: any[]) => debug(args.map(formatArg).join(" ")),
  trace: async (...args: any[]) => trace(args.map(formatArg).join(" ")),
};

export function setupLogger() {
  if (typeof window !== "undefined" && !(window as any).log) {
    (window as any).logger = logger;
  }
}
