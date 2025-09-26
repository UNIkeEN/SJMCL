import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export const createWindow = (
  label?: string, // only allow to contain a-zA-Z plus "-", "/", ":", "_" (space will convert to "_")
  route?: string,
  options?: any // Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> & WindowOptions)
): WebviewWindow => {
  // use current timestamp as the unique label if none is provided
  let windowLabel = label || `${Date.now()}`;

  windowLabel = windowLabel.replaceAll(" ", "_");

  const newWindow = new WebviewWindow(windowLabel, {
    title: "",
    minWidth: 800,
    minHeight: 550,
    width: 800,
    height: 550,
    ...options,
    url: route || "/",
  });

  newWindow.once("tauri://created", () => {
    console.log(`Child window ${windowLabel} successfully created`);
  });

  newWindow.once("tauri://error", (error) => {
    console.error(`Failed to create child window ${windowLabel}:`, error);
  });

  return newWindow;
};

export const parseIdFromWindowLabel = (label: string): number => {
  const match = label.match(/(game_error|game_log)_(\d+)/);
  if (match) {
    return parseInt(match[2], 10);
  }
  return 0; // or throw an error if preferred
};
