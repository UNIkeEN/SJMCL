import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { LauncherConfig, VersionMetaInfo } from "@/models/config";
import { InvokeResponse } from "@/models/response";
import { JavaInfo } from "@/models/system-info";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing launcher configurations.
 */
export class ConfigService {
  /**
   * RETRIEVE the launcher configs.
   * @returns {Promise<InvokeResponse<LauncherConfig>>}
   */
  @responseHandler("config")
  static async retrieveLauncherConfig(): Promise<
    InvokeResponse<LauncherConfig>
  > {
    return await invoke("retrieve_launcher_config");
  }

  /**
   * UPDATE the launcher configs.
   * @param {string} keyPath The key path to update.
   * @param {any} value The new value.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("config")
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
  @responseHandler("config")
  static async restoreLauncherConfig(): Promise<
    InvokeResponse<LauncherConfig>
  > {
    return await invoke("restore_launcher_config");
  }

  /**
   * EXPORT the launcher configs to the meta server and get a token code.
   * @returns {Promise<InvokeResponse<string>>} the token code if its successful.
   */
  @responseHandler("config")
  static async exportLauncherConfig(): Promise<InvokeResponse<string>> {
    return await invoke("export_launcher_config");
  }

  /**
   * IMPORT the launcher configs from the meta server using the token code.
   * @returns {Promise<InvokeResponse<LauncherConfig>>} the launcher configs from the server, which have been saved in backend.
   */
  @responseHandler("config")
  static async importLauncherConfig(
    code: string
  ): Promise<InvokeResponse<LauncherConfig>> {
    return await invoke("import_launcher_config", { code });
  }

  /**
   * REVEAL the launcher config file in the system file manager.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("config")
  static async revealLauncherConfig(): Promise<InvokeResponse<void>> {
    return await invoke("reveal_launcher_config");
  }

  /**
   * RETRIEVE the list of custom background files.
   * @returns {Promise<InvokeResponse<string[]>>} A list of background file names.
   */
  @responseHandler("config")
  static async retrieveCustomBackgroundList(): Promise<
    InvokeResponse<string[]>
  > {
    return await invoke("retrieve_custom_background_list");
  }

  /**
   * ADD a custom background image.
   * @param {string} sourceSrc The file path of the background image.
   * @returns {Promise<InvokeResponse<string>>} The saved background file name.
   */
  @responseHandler("config")
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
  @responseHandler("config")
  static async deleteCustomBackground(
    fileName: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_custom_background", { fileName });
  }

  /**
   * RETRIEVE the list of installed Java versions.
   * @returns {Promise<InvokeResponse<JavaInfo[]>>} A list of installed Java versions.
   */
  @responseHandler("config")
  static async retrieveJavaList(): Promise<InvokeResponse<JavaInfo[]>> {
    return await invoke("retrieve_java_list");
  }

  /**
   * VALIDATE a Java executable.
   * @param {string} javaPath The path to the Java executable.
   * @returns {Promise<InvokeResponse<void>>} Returns void if valid, otherwise throws an error.
   */
  @responseHandler("config")
  static async validateJava(javaPath: string): Promise<InvokeResponse<void>> {
    return await invoke("validate_java", { javaPath });
  }

  /**
   * DOWNLOAD Java runtime distributed by Mojang API.
   * @param {string} version - Java version to download
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("config")
  static async downloadMojangJava(
    version: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("download_mojang_java", { version });
  }

  /**
   * CHECK whether the game directory is valid.
   * @param {string} dir The game directory to check.
   * @returns {Promise<InvokeResponse<string>>} The sub directory if a sub game directory is valid.
   */
  @responseHandler("config")
  static async checkGameDirectory(
    dir: string
  ): Promise<InvokeResponse<string>> {
    return await invoke("check_game_directory", { dir });
  }

  /**
   * CLEAR the download cache directory.
   * @returns {Promise<InvokeResponse<void>>} Returns void if successful.
   */
  @responseHandler("config")
  static async clearDownloadCache(): Promise<InvokeResponse<void>> {
    return await invoke("clear_download_cache");
  }

  /**
   * CHECK for launcher updates.
   * @returns {Promise<InvokeResponse<VersionMetaInfo>>} The latest release meta info if an update is available.
   * If the current version is up-to-date, returns "up2date", otherwise an empty string.
   */
  @responseHandler("config")
  static async checkLauncherUpdate(): Promise<InvokeResponse<VersionMetaInfo>> {
    return await invoke("check_launcher_update");
  }

  /**
   * DOWNLOAD the launcher update.
   * @param {VersionMetaInfo} version The version meta info of the new version.
   * @returns {Promise<InvokeResponse<void>>} Returns void if the download process is started successfully.
   */
  @responseHandler("config")
  static async downloadLauncherUpdate(
    version: VersionMetaInfo
  ): Promise<InvokeResponse<void>> {
    return await invoke("download_launcher_update", { version });
  }

  /**
   * INSTALL the launcher update.
   * @param {string} downloadedFilename The name of the downloaded new version file.
   * @param {boolean} restart Whether to restart the launcher now.
   * @returns {Promise<InvokeResponse<void>>} Returns void if the update process is started successfully.
   */
  @responseHandler("config")
  static async installLauncherUpdate(
    downloadedFilename: string,
    restart: boolean
  ): Promise<InvokeResponse<void>> {
    return await invoke("install_launcher_update", {
      downloadedFilename,
      restart,
    });
  }

  /**
   * Listens for backend-initiated changes to the `config` field.
   * @param callback - Callback function invoked whenever the config is updated by the backend.
   */
  static onConfigPartialUpdate(
    callback: (payload: { path: string; value: any }) => void
  ) {
    const unlisten = getCurrentWebview().listen<{ path: string; value: any }>(
      "config:partial-update",
      (event) => {
        callback(event.payload);
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}
