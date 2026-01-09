import { invoke } from "@tauri-apps/api/core";
import { InstanceSubdirType } from "@/enums/instance";
import { GameConfig, GameDirectory } from "@/models/config";
import {
  GameServerInfo,
  InstanceSummary,
  LocalModInfo,
  ModpackMetaInfo,
  ResourcePackInfo,
  SchematicInfo,
  ScreenshotInfo,
  ShaderPackInfo,
} from "@/models/instance/misc";
import { LevelData, WorldInfo } from "@/models/instance/world";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
} from "@/models/resource";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing instances and its local resources.
 */
export class InstanceService {
  /**
   * RETRIEVE the list of local instances.
   * @returns {Promise<InvokeResponse<InstanceSummary[]>>}
   */
  @responseHandler("instance")
  static async retrieveInstanceList(): Promise<
    InvokeResponse<InstanceSummary[]>
  > {
    return await invoke("retrieve_instance_list");
  }

  /**
   * CREATE the new instance (include download client, resource and create config).
   * @param {GameDirectory} directory - The directory where the instance should be created.
   * @param {string} name - The name of the instance.
   * @param {string} description - The description of the instance.
   * @param {string} iconSrc - The icon source of the instance.
   * @param {GameClientResourceInfo} game - The game resource info of the instance.
   * @param {ModLoaderResourceInfo} modLoader - The mod loader info of the instance.
   * @param {OptiFineResourceInfo} [optifine] - Optional OptiFine installation.
   * @param {string} [modpackPath] - Optional path to the modpack archive file.
   * @param {boolean} [isInstallFabricApi] - Optional flag to indicate whether to install Fabric API (only valid when modLoader is Fabric).
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("instance")
  static async createInstance(
    directory: GameDirectory,
    name: string,
    description: string,
    iconSrc: string,
    game: GameClientResourceInfo,
    modLoader: ModLoaderResourceInfo,
    optifine?: OptiFineResourceInfo,
    modpackPath?: string,
    isInstallFabricApi?: boolean
  ): Promise<InvokeResponse<null>> {
    return await invoke("create_instance", {
      directory,
      name,
      description,
      iconSrc,
      game,
      modLoader,
      optifine,
      modpackPath,
      isInstallFabricApi,
    });
  }

  /**
   * UPDATE a specific key of the instance's config (include basic info and game config).
   * @param {string} instanceId - The ID of the instance.
   * @param {string} keyPath - Path to the key to update, e.g., "spec_game_config.javaPath".
   * @param {string} value - New value (as string) to be set.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async updateInstanceConfig(
    instanceId: string,
    keyPath: string,
    value: any
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_instance_config", {
      instanceId,
      keyPath,
      value: JSON.stringify(value),
    });
  }

  /**
   * RETRIEVE the game config for a given instance.
   * @param {string} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<GameConfig>>}
   * * return specific game configs if the specific configuration is enabled; otherwise, return the global game configs.
   */
  @responseHandler("instance")
  static async retrieveInstanceGameConfig(
    instanceId: string
  ): Promise<InvokeResponse<GameConfig>> {
    return await invoke("retrieve_instance_game_config", {
      instanceId,
    });
  }

  /**
   * RESET the instance game config to use global default game config.
   * @param {string} instanceId - The ID of the instance.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async resetInstanceGameConfig(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("reset_instance_game_config", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the local path to the specified instance subdir.
   * @param {string} instanceId - The instance ID.
   * @param {InstanceSubdirType} dirType - The subdir type.
   * @returns {Promise<InvokeResponse<string>>}
   */
  @responseHandler("instance")
  static async retrieveInstanceSubdirPath(
    instanceId: string,
    dirType: InstanceSubdirType
  ): Promise<InvokeResponse<string>> {
    return await invoke("retrieve_instance_subdir_path", {
      instanceId,
      dirType,
    });
  }

  /**
   * DELETE the specified instance's version folder from disk.
   * @param {string} instanceId - The instance ID to delete.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async deleteInstance(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_instance", {
      instanceId,
    });
  }

  /**
   * RENAME the specified instance (will update version folder name and field in version JSON).
   * @param {string} instanceId - The instance ID to rename.
   * @param {string} newName - New name
   * @returns {Promise<InvokeResponse<string>>} - New version path, for the frontend to sync update.
   */
  @responseHandler("instance")
  static async renameInstance(
    instanceId: string,
    newName: string
  ): Promise<InvokeResponse<string>> {
    return await invoke("rename_instance", {
      instanceId,
      newName,
    });
  }

  /**
   * COPY the specified resource to the target instance(s).
   * @param {string} srcFilePath - The path of the file (or the directory) to copy.
   * @param {string[]} tgtInstIds - ID of the target instance(s).
   * @param {InstanceSubdirType} tgtDirType - The instance subdir type to operate.
   * @param {boolean} [decompress=false] - Whether to decompress as a zip file
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async copyResourceToInstances(
    srcFilePath: string,
    tgtInstIds: string[],
    tgtDirType: InstanceSubdirType,
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
   * @param {string} tgtInstId - The target instance ID.
   * @param {InstanceSubdirType} tgtDirType - The instance subdir type to operate.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async moveResourceToInstance(
    srcFilePath: string,
    tgtInstId: string,
    tgtDirType: InstanceSubdirType
  ): Promise<InvokeResponse<void>> {
    return await invoke("move_resource_to_instance", {
      srcFilePath,
      tgtInstId,
      tgtDirType,
    });
  }

  /**
   * RETRIEVE the list of world saves.
   * @param {string} instanceId - The instance ID to retrieve the worlds for.
   * @returns {Promise<InvokeResponse<WorldInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveWorldList(
    instanceId: string
  ): Promise<InvokeResponse<WorldInfo[]>> {
    return await invoke("retrieve_world_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of game servers.
   * @param {string} instanceId - The instance ID to retrieve the game servers for.
   * @param {boolean} queryOnline - A flag to determine whether to query online server status.
   * @returns {Promise<InvokeResponse<GameServerInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveGameServerList(
    instanceId: string,
    queryOnline: boolean
  ): Promise<InvokeResponse<GameServerInfo[]>> {
    return await invoke("retrieve_game_server_list", {
      instanceId,
      queryOnline,
    });
  }

  /**
   * RETRIEVE the list of local mods.
   * @param {string} instanceId - The instance ID to retrieve the local mods for.
   * @returns {Promise<InvokeResponse<LocalModInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveLocalModList(
    instanceId: string
  ): Promise<InvokeResponse<LocalModInfo[]>> {
    return await invoke("retrieve_local_mod_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of server resource packs.
   * @param {string} instanceId - The instance ID to retrieve the server resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveServerResourcePackList(
    instanceId: string
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_server_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of resource packs.
   * @param {string} instanceId - The instance ID to retrieve the resource packs for.
   * @returns {Promise<InvokeResponse<ResourcePackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveResourcePackList(
    instanceId: string
  ): Promise<InvokeResponse<ResourcePackInfo[]>> {
    return await invoke("retrieve_resource_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of schematics.
   * @param {string} instanceId - The instance ID to retrieve the schematics for.
   * @returns {Promise<InvokeResponse<SchematicInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveSchematicList(
    instanceId: string
  ): Promise<InvokeResponse<SchematicInfo[]>> {
    return await invoke("retrieve_schematic_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of shaderpacks.
   * @param {string} instanceId - The instance ID to retrieve the shaderpacks for.
   * @returns {Promise<InvokeResponse<ShaderPackInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveShaderPackList(
    instanceId: string
  ): Promise<InvokeResponse<ShaderPackInfo[]>> {
    return await invoke("retrieve_shader_pack_list", {
      instanceId,
    });
  }

  /**
   * RETRIEVE the list of screenshots.
   * @param {string} instanceId - The instance ID to retrieve the screenshots for.
   * @returns {Promise<InvokeResponse<ScreenshotInfo[]>>}
   */
  @responseHandler("instance")
  static async retrieveScreenshotList(
    instanceId: string
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
   * @param {string} instanceId - The instance ID to retrieve the level detail for.
   * @param {string} worldName - The name of the world to retrieve details for.
   * @returns {Promise<InvokeResponse<LevelData>>}
   */
  @responseHandler("instance")
  static async retrieveWorldDetails(
    instanceId: string,
    worldName: string
  ): Promise<InvokeResponse<LevelData>> {
    return await invoke("retrieve_world_details", {
      instanceId,
      worldName,
    });
  }

  /**
   * CREATE a desktop shortcut for launching a specific instance.
   * @param {string} instanceId - The instance ID for which to create the shortcut.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("instance")
  static async createLaunchDesktopShortcut(
    instanceId: string
  ): Promise<InvokeResponse<null>> {
    return await invoke("create_launch_desktop_shortcut", {
      instanceId,
    });
  }

  /**
   * Finish the mod loader installation.
   * @param {string} instanceId - The ID of the instance to mark the mod loader as installed.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async finishModLoaderInstall(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("finish_mod_loader_install", {
      instanceId,
    });
  }

  /**
   * CHECK whether the given instance supports mod loader change.
   * @param {string} instanceId - The instance ID to check.
   * @returns {Promise<InvokeResponse<boolean>>}
   */
  @responseHandler("instance")
  static async checkChangeModLoaderAvailablity(
    instanceId: string
  ): Promise<InvokeResponse<boolean>> {
    return await invoke("check_change_mod_loader_availablity", {
      instanceId,
    });
  }

  /**
   * CHANGE the mod loader for a given instance.
   * @param {string} instanceId - The ID of the instance to update.
   * @param {ModLoaderResourceInfo} newModLoader - The new mod loader information.
   * @param {boolean} [isInstallFabricApi] - Optional flag to indicate whether to install Fabric API (only valid when modLoader is Fabric).
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async changeModLoader(
    instanceId: string,
    newModLoader: ModLoaderResourceInfo,
    isInstallFabricApi?: boolean
  ): Promise<InvokeResponse<void>> {
    return await invoke("change_mod_loader", {
      instanceId,
      newModLoader,
      isInstallFabricApi,
    });
  }

  /**
   * RETRIEVE the modpack meta info from a given manifest path.
   * @param {string} path - The path to the modpack manifest file.
   * @returns {Promise<InvokeResponse<ModpackMetaInfo>>}
   */
  @responseHandler("instance")
  static async retrieveModpackMetaInfo(
    path: string
  ): Promise<InvokeResponse<ModpackMetaInfo>> {
    return await invoke("retrieve_modpack_meta_info", {
      path,
    });
  }

  /**
   * ADD/REPLACE the custom instance icon.
   * Backend will create (if missing) or replace (if existing) the custom icon file at <version_path>/icon.
   * @param {string} instanceId - The instance ID.
   * @param {string} sourceSrc - Local file path of the source image.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("instance")
  static async addCustomInstanceIcon(
    instanceId: string,
    sourceSrc: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_custom_instance_icon", {
      instanceId,
      sourceSrc,
    });
  }
}
