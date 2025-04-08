import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for launching process.
 */
export class LaunchService {
  /**
   * SELECT suitable Java runtime environment for the specified instance.
   * @param {number} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async selectSuitableJRE(
    instanceId: number
  ): Promise<InvokeResponse<void>> {
    return await invoke("select_suitable_jre", { instanceId });
  }

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
   * VALIDATE the selected player by player ID.
   * @param {string} playerId - The player ID of the player to be refreshed.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async validateSelectedPlayer(
    playerId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("validate_selected_player", { playerId });
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

  /**
   * CANCEL the launching process.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async cancelLaunchProcess(): Promise<InvokeResponse<void>> {
    return await invoke("cancel_launch_process");
  }
}
