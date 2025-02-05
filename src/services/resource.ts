import { invoke } from "@tauri-apps/api/core";
import { GameResourceInfo } from "@/models/resource";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

const errorToLocaleKey: { [key: string]: string } = {
  PARSE_ERROR: "parseError",
  NO_DOWNLOAD_API: "noDownloadApi",
};

/**
 * Service class for managing game & mod loader resources.
 */
export class ResourceService {
  /**
   * RETRIVE the list of game versions.
   * @returns {Promise<InvokeResponse<GameResourceInfo[]>>}
   */
  @responseHandler("resource", errorToLocaleKey)
  static async retriveGameVersionList(): Promise<
    InvokeResponse<GameResourceInfo[]>
  > {
    return await invoke("retrive_game_version_list");
  }
}
