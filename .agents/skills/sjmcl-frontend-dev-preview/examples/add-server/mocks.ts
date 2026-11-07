import { t } from "i18next";
import { defaultConfig } from "@/models/config";

export function useLauncherConfig() {
  return { config: defaultConfig };
}

export const InstanceService = {
  async addGameServer(instanceId, serverAddr, serverName) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.info("addGameServer", { instanceId, serverAddr, serverName });
    return {
      status: "success",
      message: t("Services.instance.addGameServer.success"),
      data: undefined,
    };
  },
} satisfies Pick<
  typeof import("@/services/instance").InstanceService,
  "addGameServer"
>;
