import { invoke } from "@tauri-apps/api/core";
import { InstanceSubdirEnums } from "@/enums/instance";
import {
  GameInstanceSummary,
  GameServerInfo,
  LocalModInfo,
  ResourcePackInfo,
  SchematicInfo,
  ScreenshotInfo,
  ShaderPackInfo,
  WorldInfo,
} from "@/models/instance";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

const errorToLocaleKey: { [key: string]: string } = {
  INSTANCE_NOT_FOUND_BY_ID: "instanceNotFoundByID",
  EXEC_OPEN_DIR_ERROR: "execOpenDirError",
  SERVER_NBT_READ_ERROR: "serverNbtReadError",
  FILE_NOT_FOUND_ERROR: "fileNotFoundError",
  INVALID_SOURCE_PATH: "invalidSourcePath",
  FILE_COPY_FAILED: "fileCopyFailed",
  FILE_MOVE_FAILED: "fileMoveFailed",
  FOLDER_CREATION_FAILED: "folderCreationFailed",
};

/**
 * Service class for managing instances and its local resources.
 */
export class InstanceService {
  /**
   * RETRIVE the list of local instances.
   * @returns {Promise<InvokeResponse<GameInstanceSummary[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveInstanceList(): Promise<
    InvokeResponse<GameInstanceSummary[]>
  > {
    return await invoke("retrieve_instance_list");
  }

  /**
   * OPEN the specified instance subdir using system default fs manager.
   * @param {number} instanceId - The instance ID to open the subdir for.
   * @param {InstanceSubdirEnums} dirType - The instance subdir type to open.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async openInstanceSubdir(
    instanceId: number,
    dirType: InstanceSubdirEnums
  ): Promise<InvokeResponse<void>> {
    return await invoke("open_instance_subdir", {
      instanceId,
      dirType,
    });
  }

  /**
   * DELETE the specified instance's version folder from disk.
   * @param {number} instanceId - The instance ID to delete.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async deleteInstance(
    instanceId: number
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_instance", {
      instanceId,
    });
  }

  /**
   * COPY the specified resource to the target instance(s).
   * @param {string} srcFilePath - The path of the file to copy.
   * @param {number} tgtInstIds - ID of the target instance(s).
   * @param {InstanceSubdirEnums} tgtDirType - The instance subdir type to operate.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async copyAcrossInstances(
    srcFilePath: string,
    tgtInstIds: number[],
    tgtDirType: InstanceSubdirEnums
  ): Promise<InvokeResponse<void>> {
    return await invoke("copy_across_instances", {
      srcFilePath,
      tgtInstIds,
      tgtDirType,
    });
  }

  /**
   * MOVE the specified resource to the target instance.
   * @param {string} srcFilePath - The path of the file to move.
   * @param {number} tgtInstId - The target instance ID.
   * @param {InstanceSubdirEnums} tgtDirType - The instance subdir type to operate.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async moveAcrossInstances(
    srcFilePath: string,
    tgtInstId: number,
    tgtDirType: InstanceSubdirEnums
  ): Promise<InvokeResponse<void>> {
    return await invoke("move_across_instances", {
      srcFilePath,
      tgtInstId,
      tgtDirType,
    });
  }

  /**
   * RETRIVE the list of world saves.
   * @param {number} instanceId - The instance ID to retrieve the worlds for.
   * @returns {Promise<InvokeResponse<WorldInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveWorldList(
    instanceId: number
  ): Promise<InvokeResponse<WorldInfo[]>> {
    return await invoke("retrieve_world_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of game servers.
   * @param {number} instanceId - The instance ID to retrieve the game servers for.
   * @param {boolean} queryOnline - A flag to determine whether to query online server status.
   * @returns {Promise<InvokeResponse<GameServerInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveGameServerList(
    instanceId: number,
    queryOnline: boolean
  ): Promise<InvokeResponse<GameServerInfo[]>> {
    return await invoke("retrieve_game_server_list", {
      instanceId,
      queryOnline,
    });
  }

  /**
   * RETRIVE the list of local mods.
   * @param {number} instanceId - The instance ID to retrieve the local mods for.
   * @returns {Promise<InvokeResponse<LocalModInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveLocalModList(
    instanceId: number
  ): Promise<InvokeResponse<LocalModInfo[]>> {
    return await invoke("retrieve_local_mod_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of server resource packs.
   * @param {number} instanceId - The instance ID to retrieve the server resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveServerResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_server_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of resource packs.
   * @param {number} instanceId - The instance ID to retrieve the resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of schematics.
   * @param {number} instanceId - The instance ID to retrieve the schematics for.
   * @returns {Promise<InvokeResponse<SchematicInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveSchematicList(
    instanceId: number
  ): Promise<InvokeResponse<SchematicInfo[]>> {
    return await invoke("retrieve_schematic_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of shaderpacks.
   * @param {number} instanceId - The instance ID to retrieve the shaderpacks for.
   * @returns {Promise<InvokeResponse<ShaderPackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveShaderPackList(
    instanceId: number
  ): Promise<InvokeResponse<ShaderPackInfo[]>> {
    return await invoke("retrieve_shader_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of screenshots.
   * @param {number} instanceId - The instance ID to retrieve the screenshots for.
   * @returns {Promise<InvokeResponse<ScreenshotInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retrieveScreenshotList(
    instanceId: number
  ): Promise<InvokeResponse<ScreenshotInfo[]>> {
    return await invoke("retrieve_screenshot_list", {
      instanceId,
    });
  }

  /**
   * TOGGLE the mod status by changing the file extension.
   * @param {string} filePath - The path of the file to toggle mod for.
   * @param {boolean} enable - Whether to enable or disable the mod (true to enable, false to disable).
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async toggleModByExtension(
    filePath: string,
    enable: boolean
  ): Promise<InvokeResponse<void>> {
    return await invoke("toggle_mod_by_extension", {
      filePath,
      enable,
    });
  }
}
