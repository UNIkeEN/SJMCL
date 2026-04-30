import { invoke } from "@tauri-apps/api/core";
import { type, version } from "@tauri-apps/plugin-os";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

export class MultiplayerService {
  static async checkPlatformSupport(): Promise<InvokeResponse<boolean>> {
    try {
      if (type() !== "windows") {
        return { status: "success", message: "", data: false };
      }
      const [major, _minor, build] = version().split(".").map(Number);
      const supported = major >= 10 && build >= 10240;
      return { status: "success", message: "", data: supported };
    } catch (e) {
      return {
        status: "error",
        message: String(e),
        details: "",
        raw_error: String(e),
      };
    }
  }

  @responseHandler("multiplayer")
  static async checkTerracotta(): Promise<InvokeResponse<boolean>> {
    return await invoke("check_terracotta");
  }

  @responseHandler("multiplayer")
  static async launchTerracotta(): Promise<InvokeResponse<void>> {
    return await invoke("launch_terracotta");
  }

  @responseHandler("multiplayer")
  static async downloadTerracotta(): Promise<InvokeResponse<void>> {
    return await invoke("download_terracotta");
  }

  @responseHandler("multiplayer")
  static async fetchPort(): Promise<InvokeResponse<number>> {
    return await invoke("fetch_port");
  }
}
