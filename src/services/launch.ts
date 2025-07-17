import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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
  static async launchGame(): Promise<InvokeResponse<void>> {
    return await invoke("launch_game");
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
   * @param log_label The label of the game log.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("launch")
  static async openGameLogWindow(
    logLabel: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("open_game_log_window", { logLabel });
  }

  /**
   * RETRIEVE the game log content according to the specified log label.
   * Typically used when opening the game log window for the first time during instance runtime.
   * @param log_label The label of the game log.
   * @returns {Promise<InvokeResponse<string[]>>}
   */
  @responseHandler("launch")
  static async retrieveGameLog(
    logLabel: string
  ): Promise<InvokeResponse<string[]>> {
    return await invoke("retrieve_game_log", { logLabel });
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
