import { invoke } from "@tauri-apps/api/core";
import { LauncherConfig } from "@/models/config";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

const errorToLocaleKey: { [key: string]: string } = {
  FETCH_ERROR: "fetchError",
  INVALID_CODE: "invalidCode",
  CODE_EXPIRED: "codeExpired",
  VERSION_MISMATCH: "versionMismatch",
};

/**
 * Service class for managing launcher configurations.
 */
export class ConfigService {
  /**
   * RETRIVE the launcher configs.
   * @returns {Promise<InvokeResponse<LauncherConfig>>}
   */
  @responseHandler("config", errorToLocaleKey)
  static async retriveLauncherConfig(): Promise<
    InvokeResponse<LauncherConfig>
  > {
    return await invoke("retrive_launcher_config");
  }

  /**
   * UPDATE the launcher configs.
   * @param {string} keyPath The key path to update.
   * @param {any} value The new value.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("config", errorToLocaleKey)
  static async updateLauncherConfig(
    keyPath: string,
    value: any
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_launcher_config", {
      keyPath,
      value: JSON.stringify(value),
    });
  }

  /**
   * RESTORE the launcher configs to their default state and returns the new configuration.
   * @returns {Promise<InvokeResponse<LauncherConfig>>}
   */
  @responseHandler("config", errorToLocaleKey)
  static async restoreLauncherConfig(): Promise<
    InvokeResponse<LauncherConfig>
  > {
    return await invoke("restore_launcher_config");
  }

  /**
   * EXPORT the launcher configs to the meta server and get a token code.
   * @returns {Promise<InvokeResponse<string>>} the token code if its successful.
   */
  @responseHandler("config", errorToLocaleKey)
  static async exportLauncherConfig(): Promise<InvokeResponse<string>> {
    return await invoke("export_launcher_config");
  }

  /**
   * IMPORT the launcher configs from the meta server using the token code.
   * @returns {Promise<InvokeResponse<LauncherConfig>>} the launcher configs from the server, which have been saved in backend.
   */
  @responseHandler("config", errorToLocaleKey)
  static async importLauncherConfig(
    code: string
  ): Promise<InvokeResponse<LauncherConfig>> {
    return await invoke("import_launcher_config", { code });
  }

  /**
   * RETRIVE the list of custom background files.
   * @returns {Promise<InvokeResponse<string[]>>} A list of background file names.
   */
  @responseHandler("config", errorToLocaleKey)
  static async retriveCustomBackgroundList(): Promise<
    InvokeResponse<string[]>
  > {
    return await invoke("retrive_custom_background_list");
  }

  /**
   * ADD a custom background image.
   * @param {string} sourceSrc The file path of the background image.
   * @returns {Promise<InvokeResponse<string>>} The saved background file name.
   */
  @responseHandler("config", errorToLocaleKey)
  static async addCustomBackground(
    sourceSrc: string
  ): Promise<InvokeResponse<string>> {
    return await invoke("add_custom_background", { sourceSrc });
  }

  /**
   * DELETE a custom background image.
   * @param {string} fileName The name of the background image to delete.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("config", errorToLocaleKey)
  static async deleteCustomBackground(
    fileName: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_custom_background", { fileName });
  }
}
