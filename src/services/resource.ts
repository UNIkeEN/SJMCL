import { invoke } from "@tauri-apps/api/core";
import { ModLoaderType } from "@/enums/instance";
import {
  GameResourceInfo,
  ModLoaderResourceInfo,
  OtherResourceSearchRes,
  ResourceVersionPack,
} from "@/models/resource";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing game & mod loader resources.
 */
export class ResourceService {
  /**
   * FETCH the list of game versions.
   * @returns {Promise<InvokeResponse<GameResourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchGameVersionList(): Promise<
    InvokeResponse<GameResourceInfo[]>
  > {
    return await invoke("fetch_game_version_list");
  }

  /**
   * FETCH the list of mode loader versions.
   * @returns {Promise<InvokeResponse<ModLoaderResourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchModLoaderVersionList(
    gameVersion: string,
    modLoaderType: ModLoaderType
  ): Promise<InvokeResponse<ModLoaderResourceInfo[]>> {
    return await invoke("fetch_mod_loader_version_list", {
      gameVersion,
      modLoaderType,
    });
  }

  /**
   * FETCH the list of resources according to the given parameters.
   * @returns {Promise<InvokeResponse<OtherResourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchResourceListByName(
    resourceType: string,
    searchQuery: string,
    gameVersion: string,
    selectedTag: string,
    sortBy: string,
    downloadSource: string,
    page: number,
    pageSize: number
  ): Promise<InvokeResponse<OtherResourceSearchRes>> {
    return await invoke("fetch_resource_list_by_name", {
      downloadSource,
      query: {
        resourceType,
        searchQuery,
        gameVersion,
        selectedTag,
        sortBy,
        page,
        pageSize,
      },
    });
  }

  /**
   * FETCH the version packs for a specific resource.
   * @returns {Promise<InvokeResponse<ResourceVersionPack[]>>}
   */
  @responseHandler("resource")
  static async fetchResourceVersionPacks(
    resourceId: string,
    modLoader: ModLoaderType | "All",
    gameVersions: string[],
    downloadSource: string
  ): Promise<InvokeResponse<ResourceVersionPack[]>> {
    return await invoke("fetch_resource_version_packs", {
      downloadSource,
      query: {
        resourceId,
        modLoader,
        gameVersions,
      },
    });
  }

  /**
   * DOWNLOAD a game server.
   * @param {GameResourceInfo} resourceInfo - The resource information of the game server.
   * @param {string} dest - The destination path to save the downloaded server file.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("resource")
  static async downloadGameServer(
    resourceInfo: GameResourceInfo,
    dest: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("download_game_server", {
      resourceInfo,
      dest,
    });
  }
}
