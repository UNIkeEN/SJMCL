import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for launching process.
 */
export class LaunchService {
  /**
   * VALIDATE the specified instance's game files.
   * @param {number} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async validateGameFiles(
    instanceId: number
  ): Promise<InvokeResponse<void>> {
    return await invoke("validate_game_files", { instanceId });
  }

  /**
   * LAUNCH the specified game instance.
   * @param {number} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async launchGame(instanceId: number): Promise<InvokeResponse<void>> {
    return await invoke("launch_game", { instanceId });
  }
}
