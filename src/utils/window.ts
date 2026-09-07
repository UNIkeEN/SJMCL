import { type WindowConfig } from "@/models/misc";
import { UtilsService } from "@/services/utils";

export const createWindow = (
  label?: string, // only allow to contain a-zA-Z plus "-", "/", ":", "_" (space will convert to "_")
  route?: string,
  options?: Pick<WindowConfig, "title" | "minWidth" | "minHeight">
) => {
  // use current timestamp as the unique label if none is provided
  let windowLabel = label || `${Date.now()}`;
  windowLabel = windowLabel.replaceAll(" ", "_");

  (async () => {
    const response = await UtilsService.createWindow(
      {
        label: windowLabel,
        url: route || "/",
        title: options?.title,
        height: 550,
        minWidth: options?.minWidth,
        minHeight: options?.minHeight,
      },
      true
    );
    if (response.status === "success") {
      logger.info(`Child window ${windowLabel} successfully created`);
    }
  })();
};

export const parseIdFromWindowLabel = (label: string): number => {
  const match = label.match(/(game_error|game_log)_(\d+)/);
  if (match) {
    return parseInt(match[2], 10);
  }
  return 0; // or throw an error if preferred
};
