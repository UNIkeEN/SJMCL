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
  INVALID_SOURCE_PATH: "invalidSourcePath",
  FILE_COPY_FAILED: "fileCopyFailed",
  FILE_MOVE_FAILED: "fileMoveFailed",
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
  static async retriveInstanceList(): Promise<
    InvokeResponse<GameInstanceSummary[]>
  > {
    return await invoke("retrive_instance_list");
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
   * @param {number} instanceId - The instance ID to retrive the worlds for.
   * @returns {Promise<InvokeResponse<WorldInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveWorldList(
    instanceId: number
  ): Promise<InvokeResponse<WorldInfo[]>> {
    return await invoke("retrive_world_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of game servers.
   * @param {number} instanceId - The instance ID to retrive the game servers for.
   * @param {boolean} queryOnline - A flag to determine whether to query online server status.
   * @returns {Promise<InvokeResponse<GameServerInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveGameServerList(
    instanceId: number,
    queryOnline: boolean
  ): Promise<InvokeResponse<GameServerInfo[]>> {
    return await invoke("retrive_game_server_list", {
      instanceId,
      queryOnline,
    });
  }

  /**
   * RETRIVE the list of local mods.
   * @param {number} instanceId - The instance ID to retrive the local mods for.
   * @returns {Promise<InvokeResponse<LocalModInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveLocalModList(
    instanceId: number
  ): Promise<InvokeResponse<LocalModInfo[]>> {
    return await invoke("retrive_local_mod_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of server resource packs.
   * @param {number} instanceId - The instance ID to retrive the server resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveServerResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrive_server_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of resource packs.
   * @param {number} instanceId - The instance ID to retrive the resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveResourcePackList(
    instanceId: number
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrive_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of schematics.
   * @param {number} instanceId - The instance ID to retrive the schematics for.
   * @returns {Promise<InvokeResponse<SchematicInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveSchematicList(
    instanceId: number
  ): Promise<InvokeResponse<SchematicInfo[]>> {
    return await invoke("retrive_schematic_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of shaderpacks.
   * @param {number} instanceId - The instance ID to retrive the shaderpacks for.
   * @returns {Promise<InvokeResponse<ShaderPackInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveShaderPackList(
    instanceId: number
  ): Promise<InvokeResponse<ShaderPackInfo[]>> {
    return await invoke("retrive_shader_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIVE the list of screenshots.
   * @param {number} instanceId - The instance ID to retrive the screenshots for.
   * @returns {Promise<InvokeResponse<ScreenshotInfo[]>>}
   */
  @responseHandler("instance", errorToLocaleKey)
  static async retriveScreenshotList(
    instanceId: number
  ): Promise<InvokeResponse<ScreenshotInfo[]>> {
    return await invoke("retrive_screenshot_list", {
      instanceId,
    });
  }
}
