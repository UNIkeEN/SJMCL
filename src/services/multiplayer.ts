import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

export class MultiplayerService {
  @responseHandler("multiplayer")
  static async checkTerracotta(): Promise<InvokeResponse<boolean>> {
    return await invoke("check_terracotta");
  }

  @responseHandler("multiplayer")
  static async launchTerracotta(): Promise<InvokeResponse<void>> {
    return await invoke("launch_terracotta");
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
  @responseHandler("multiplayer")
  static async fetchPort(): Promise<InvokeResponse<number>> {
    return await invoke("fetch_port");
  }
}
