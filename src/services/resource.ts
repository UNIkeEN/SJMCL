import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ModLoaderType } from "@/enums/instance";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  ModUpdateQuery,
  OptiFineResourceInfo,
  OtherResourceFileInfo,
  OtherResourceInfo,
  OtherResourceSearchRes,
  OtherResourceVersionPack,
} from "@/models/resource";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing game & mod loader resources.
 */
export class ResourceService {
  /**
   * FETCH the list of game versions with download metadata.
   * @returns {Promise<InvokeResponse<GameClientResourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchGameVersionList(): Promise<
    InvokeResponse<GameClientResourceInfo[]>
  > {
    return await invoke("fetch_game_version_list");
  }

  /**
   * FETCH a specific game version's download metadata.
   * @param {string} gameVersion - The specific version to fetch.
   * @returns {Promise<InvokeResponse<GameClientResourceInfo>>}
   */
  @responseHandler("resource")
  static async fetchGameVersionSpecific(
    gameVersion: string
  ): Promise<InvokeResponse<GameClientResourceInfo>> {
    return await invoke("fetch_game_version_specific", { gameVersion });
  }

  /**
   * FETCH the list of mode loader versions.
   * @param {string} gameVersion - The game version to fetch mod loaders for.
   * @param {ModLoaderType} modLoaderType - The type of mod loader to fetch.
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
   * FETCH the list of OptiFine versions.
   * @param {string} gameVersion - The game version to fetch OptiFine versions for.
   * @returns {Promise<InvokeResponse<OptiFineResourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchOptiFineVersionList(
    gameVersion: string
  ): Promise<InvokeResponse<OptiFineResourceInfo[]>> {
    return await invoke("fetch_optifine_version_list", { gameVersion });
  }

  /**
   * FETCH the list of resources according to the given parameters.
   * @returns {Promise<InvokeResponse<OtherResourceSearchRes>>}
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
   * @returns {Promise<InvokeResponse<OtherResourceVersionPack[]>>}
   */
  @responseHandler("resource")
  static async fetchResourceVersionPacks(
    resourceId: string,
    modLoader: ModLoaderType | "All",
    gameVersions: string[],
    downloadSource: OtherResourceSource
  ): Promise<InvokeResponse<OtherResourceVersionPack[]>> {
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
   * @param {GameClientResourceInfo} resourceInfo - The resource information of the game server.
   * @param {string} dest - The destination path to save the downloaded server file.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("resource")
  static async downloadGameServer(
    resourceInfo: GameClientResourceInfo,
    dest: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("download_game_server", {
      resourceInfo,
      dest,
    });
  }

  /**
   * FETCH a remote resource info by local file.
   * @param filePath The file path of the resource.
   * @param downloadSource The source from which to download the resource.
   * @returns {Promise<InvokeResponse<OtherResourceFileInfo>>}
   */
  @responseHandler("resource")
  static async fetchRemoteResourceByLocal(
    downloadSource: OtherResourceSource,
    filePath: string
  ): Promise<InvokeResponse<OtherResourceFileInfo>> {
    return await invoke("fetch_remote_resource_by_local", {
      downloadSource,
      filePath,
    });
  }

  /**
   * UPDATE mods in an instance based on the provided queries.
   * @param instanceId The ID of the instance.
   * @param queries The list of mod update queries.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("resource")
  static async updateMods(
    instanceId: string,
    queries: ModUpdateQuery[]
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_mods", {
      instanceId,
      queries,
    });
  }

  /**
   * FETCH a remote resource by ID.
   * @param downloadSource The source from which to download the resource.
   * @param resourceId The ID of the resource.
   * @returns {Promise<InvokeResponse<OtherResourceInfo>>}
   */
  @responseHandler("resource")
  static async fetchRemoteResourceById(
    downloadSource: OtherResourceSource,
    resourceId: string
  ): Promise<InvokeResponse<OtherResourceInfo>> {
    return await invoke("fetch_remote_resource_by_id", {
      downloadSource,
      resourceId,
    });
  }

  /**
   * Listen for resource refresh events.
   * @param callback - The callback to be invoked when a resource refresh event occurs.
   */
  static onResourceRefresh(
    callback: (payload: OtherResourceType) => void
  ): () => void {
    const unlisten = getCurrentWebview().listen<OtherResourceType>(
      "instance:refresh-resource-list",
      (event) => {
        callback(event.payload);
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}
