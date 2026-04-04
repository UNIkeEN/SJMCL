import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

export class MultiplayerService {
  @responseHandler("multiplayer")
  static async checkTerracottaSupport(): Promise<InvokeResponse<boolean>> {
    return await invoke("check_terracotta_support");
  }

  @responseHandler("multiplayer")
  static async createRoom(): Promise<InvokeResponse<string>> {
    return await invoke("create_room");
  }

  @responseHandler("multiplayer")
  static async downloadTerracotta(): Promise<InvokeResponse<void>> {
    return await invoke("download_terracotta");
  }

  @responseHandler("multiplayer")
  static async joinRoom(inviteCode: string): Promise<InvokeResponse<void>> {
    return await invoke("join_room", { inviteCode });
  }
}
