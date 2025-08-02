import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { LaunchingState } from "@/models/launch";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for launching process.
 */
export class LaunchService {
  /**
   * Launching Step 1: select suitable Java runtime environment for the specified instance.
   * At this step, pass the ID of the instance to be launched (which may not be the same as the selected instance ID), and no further input is required afterwards.
   * @param {string} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async selectSuitableJRE(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("select_suitable_jre", { instanceId });
  }

  /**
   * Launching Step 2: extract native libraries, validate the specified instance's game files.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async validateGameFiles(): Promise<InvokeResponse<void>> {
    return await invoke("validate_game_files");
  }

  /**
   * Launching Step 3: validate the selected player, prepare prefetched server meta for authlib-injector.
   * The selected player ID is retrieved by the backend itself from the config state.
   * @returns {Promise<InvokeResponse<boolean>>} false if the access token is expired.
   */
  @responseHandler("launch")
  static async validateSelectedPlayer(): Promise<InvokeResponse<boolean>> {
    return await invoke("validate_selected_player");
  }

  /**
   * Launching Step 4: generate command args, launch the game instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async launchGame(
    quickPlaySingleplayer?: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("launch_game", { quickPlaySingleplayer });
  }

  /**
   * CANCEL the launching process.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async cancelLaunchProcess(): Promise<InvokeResponse<void>> {
    return await invoke("cancel_launch_process");
  }

  /**
   * OPEN the game log window during instance runtime.
   * @param {number} launchingId The id of the launching state.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async openGameLogWindow(
    launchingId: number
  ): Promise<InvokeResponse<void>> {
    return await invoke("open_game_log_window", { launchingId });
  }

  /**
   * RETRIEVE the game log content according to the specified log label.
   * Typically used when opening the game log window for the first time during instance runtime.
   * @param {number} launchingId The id of the launching state.
   * @returns {Promise<InvokeResponse<string[]>>}
   */
  @responseHandler("launch")
  static async retrieveGameLog(
    launchingId: number
  ): Promise<InvokeResponse<string[]>> {
    return await invoke("retrieve_game_log", { launchingId });
  }

  /**
   * RETRIEVE the game launching state.
   * This command is usually called by the game error window when game process crashed.
   * @param {number} launchingId The id of the launching state to retrieve.
   * @returns {Promise<InvokeResponse<LaunchingState>>} The current game launching state.
   */
  @responseHandler("launch")
  static async retrieveGameLaunchingState(
    launchingId: number
  ): Promise<InvokeResponse<LaunchingState>> {
    return await invoke("retrieve_game_launching_state", { launchingId });
  }

  /**
   * EXPORT the game crash info to a zip file and reveal it in the file explorer.
   * This command is usually called by the game error window when game process crashed.
   * @param {number} launchingId The id of the launching state to export.
   * @param {string} savePath The path to save the exported zip file.
   * @returns {Promise<InvokeResponse<string>>} The path of the exported zip file.
   */
  @responseHandler("launch")
  static async exportGameCrashInfo(
    launchingId: number,
    savePath: string
  ): Promise<InvokeResponse<string>> {
    return await invoke("export_game_crash_info", { launchingId, savePath });
  }

  /**
   * LISTEN to the game log output line by line.
   * @param callback The callback function to be called when the game log is output.
   */
  static onGameProcessOutput(callback: (payload: string) => void) {
    const unlisten = getCurrentWebview().listen<string>(
      "launch:game-process-output",
      (event) => {
        callback(event.payload);
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}
