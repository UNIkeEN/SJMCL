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
} from "@/models/instance/misc";
import { LevelData, WorldInfo } from "@/models/instance/world";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing instances and its local resources.
 */
export class InstanceService {
  /**
   * RETRIEVE the list of local instances.
   * @returns {Promise<InvokeResponse<GameInstanceSummary[]>>}
   */
  @responseHandler("instance")
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
  @responseHandler("instance")
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
  @responseHandler("instance")
  static async deleteInstance(
    instanceId: number
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_instance", {
      instanceId,
    });
  }

  /**
   * RENAME the specified instance (will update version folder name and field in version JSON).
   * @param {number} instanceId - The instance ID to rename.
   * @param {string} newName - New name
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async renameInstance(
    instanceId: number,
    newName: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("rename_instance", {
      instanceId,
      newName,
    });
  }

  /**
   * COPY the specified resource to the target instance(s).
   * @param {string} srcFilePath - The path of the file (or the directory) to copy.
   * @param {number[]} tgtInstIds - ID of the target instance(s).
   * @param {InstanceSubdirEnums} tgtDirType - The instance subdir type to operate.
   * @param {boolean} [decompress=false] - Whether to decompress as a zip file
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async copyResourceToInstances(
    srcFilePath: string,
    tgtInstIds: number[],
    tgtDirType: InstanceSubdirEnums,
    decompress: boolean = false
  ): Promise<InvokeResponse<void>> {
    return await invoke("copy_resource_to_instances", {
      srcFilePath,
      tgtInstIds,
      tgtDirType,
      decompress,
    });
  }

  /**
   * MOVE the specified resource to the target instance.
   * @param {string} srcFilePath - The path of the file (or the directory) to move.
   * @param {number} tgtInstId - The target instance ID.
   * @param {InstanceSubdirEnums} tgtDirType - The instance subdir type to operate.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async moveResourceToInstance(
    srcFilePath: string,
    tgtInstId: number,
    tgtDirType: InstanceSubdirEnums
  ): Promise<InvokeResponse<void>> {
    return await invoke("move_resource_to_instance", {
      srcFilePath,
      tgtInstId,
      tgtDirType,
    });
  }

  /**
   * RETRIEVE the list of world saves.
   * @param {number} instanceId - The instance ID to retrieve the worlds for.
   * @returns {Promise<InvokeResponse<WorldInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveWorldList(
    instanceId: number
  ): Promise<InvokeResponse<WorldInfo[]>> {
    return await invoke("retrieve_world_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of game servers.
   * @param {number} instanceId - The instance ID to retrieve the game servers for.
   * @param {boolean} queryOnline - A flag to determine whether to query online server status.
   * @returns {Promise<InvokeResponse<GameServerInfo[]>>}
   */
  @responseHandler("instance")
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
   * RETRIEVE the list of local mods.
   * @param {number} instanceId - The instance ID to retrieve the local mods for.
   * @returns {Promise<InvokeResponse<LocalModInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveLocalModList(
    instanceId: number
  ): Promise<InvokeResponse<LocalModInfo[]>> {
    return await invoke("retrieve_local_mod_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of server resource packs.
   * @param {number} instanceId - The instance ID to retrieve the server resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveServerResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_server_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of resource packs.
   * @param {number} instanceId - The instance ID to retrieve the resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of schematics.
   * @param {number} instanceId - The instance ID to retrieve the schematics for.
   * @returns {Promise<InvokeResponse<SchematicInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveSchematicList(
    instanceId: number
  ): Promise<InvokeResponse<SchematicInfo[]>> {
    return await invoke("retrieve_schematic_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of shaderpacks.
   * @param {number} instanceId - The instance ID to retrieve the shaderpacks for.
   * @returns {Promise<InvokeResponse<ShaderPackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveShaderPackList(
    instanceId: number
  ): Promise<InvokeResponse<ShaderPackInfo[]>> {
    return await invoke("retrieve_shader_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of screenshots.
   * @param {number} instanceId - The instance ID to retrieve the screenshots for.
   * @returns {Promise<InvokeResponse<ScreenshotInfo[]>>}
   */
  @responseHandler("instance")
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
  @responseHandler("instance")
  static async toggleModByExtension(
    filePath: string,
    enable: boolean
  ): Promise<InvokeResponse<void>> {
    return await invoke("toggle_mod_by_extension", {
      filePath,
      enable,
    });
  }

  /**
   * RETRIEVE the level details for a specific world.
   * @param {number} instanceId - The instance ID to retrieve the level detail for.
   * @param {string} worldName - The name of the world to retrieve details for.
   * @returns {Promise<InvokeResponse<LevelData>>}
   */
  @responseHandler("instance")
  static async retrieveWorldDetails(
    instanceId: number,
    worldName: string
  ): Promise<InvokeResponse<LevelData>> {
    return await invoke("retrieve_world_details", {
      instanceId,
      worldName,
    });
  }
}
