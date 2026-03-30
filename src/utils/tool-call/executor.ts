import { gameTypesToIcon } from "@/components/modals/create-instance-modal";
import { ToolExecutionContextData } from "@/contexts/tool-call";
import { ToolCallStatus } from "@/enums/tool-call";
import { GetStateFlag } from "@/hooks/get-state";
import { NewsPostRequest } from "@/models/news-post";
import { defaultModLoaderResourceInfo } from "@/models/resource";
import { ConfigService } from "@/services/config";
import { DiscoverService } from "@/services/discover";
import { InstanceService } from "@/services/instance";
import { ResourceService } from "@/services/resource";
import { UtilsService } from "@/services/utils";

export async function executeToolCall(
  name: string,
  params: Record<string, any>,
  context: ToolExecutionContextData
): Promise<unknown> {
  const { config, t, openSharedModal, getGameVersionList } = context;

  switch (name) {
    case "retrieve_game_version_list":
      if (
        !params.type ||
        !["release", "snapshot", "old_beta", "april_fools"].includes(
          params.type
        )
      ) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing or incorrect type",
        };
      }
      let versionList = await getGameVersionList();
      if (versionList == GetStateFlag.Cancelled) {
        return { status: ToolCallStatus.Error, message: "Cancelled" };
      }
      return (versionList || []).filter((v: any) => v.gameType === params.type);
    case "retrieve_mod_loader_list_by_game_version":
      if (
        !params.version ||
        !["Fabric", "Forge", "NeoForge"].includes(params.loaderType)
      ) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing version or incorrect loaderType",
        };
      }
      return await ResourceService.fetchModLoaderVersionList(
        params.version,
        params.loaderType
      );
    case "create_instance": {
      if (!params.name || !params.description || !params.gameInfo) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing name, description or gameInfo",
        };
      }
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        instanceName: params.name,
        gameVersion: params.gameInfo.id,
        modLoader: params.modLoaderInfo?.loaderType || "none",
        directory: config.localGameDirectories[0]?.dir || "default",
      };
    }
    case "retrieve_instance_list": {
      const instListResp = await InstanceService.retrieveInstanceList();
      if (instListResp.status === ToolCallStatus.Success) {
        return instListResp.data.map((inst) => ({
          id: inst.id,
          name: inst.name,
          version: inst.version,
          modLoader: inst.modLoader,
          useSpecGameConfig: inst.useSpecGameConfig,
        }));
      }
      return instListResp;
    }
    case "retrieve_instance_game_config":
      if (!params.id) {
        return { status: ToolCallStatus.Error, message: "Missing instanceId" };
      }
      return await InstanceService.retrieveInstanceGameConfig(params.id);
    case "retrieve_instance_world_list":
      if (!params.id) {
        return { status: ToolCallStatus.Error, message: "Missing instanceId" };
      }
      return await InstanceService.retrieveWorldList(params.id);
    case "retrieve_instance_world_details":
      if (!params.instanceId || !params.worldName) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing instanceId or worldName",
        };
      }
      return await InstanceService.retrieveWorldDetails(
        params.instanceId,
        params.worldName
      );
    case "retrieve_instance_game_server_list":
      return await InstanceService.retrieveGameServerList(params.id, true);
    case "retrieve_instance_local_mod_list":
      let local_mod_list_response = await InstanceService.retrieveLocalModList(
        params.id
      );
      if (local_mod_list_response.status === ToolCallStatus.Success) {
        return local_mod_list_response.data.map((mod) => {
          return { ...mod, iconSrc: undefined }; // iconSrc is too large and useless
        });
      }
      return local_mod_list_response;
    case "retrieve_instance_resource_pack_list":
      let resource_pack_list_response =
        await InstanceService.retrieveResourcePackList(params.id);
      if (resource_pack_list_response.status === ToolCallStatus.Success) {
        return resource_pack_list_response.data.map((pack) => {
          return { ...pack, iconSrc: undefined };
        });
      }
      return resource_pack_list_response;
    case "retrieve_instance_server_resource_pack_list":
      let server_resource_pack_list_response =
        await InstanceService.retrieveServerResourcePackList(params.id);
      if (
        server_resource_pack_list_response.status === ToolCallStatus.Success
      ) {
        return server_resource_pack_list_response.data.map((pack) => {
          return { ...pack, iconSrc: undefined };
        });
      }
      return server_resource_pack_list_response;
    case "retrieve_instance_schematic_list":
      return await InstanceService.retrieveSchematicList(params.id);
    case "retrieve_instance_shader_pack_list":
      return await InstanceService.retrieveShaderPackList(params.id);
    case "launch_instance": {
      if (!params.id) {
        return { status: ToolCallStatus.Error, message: "Missing instance id" };
      }
      let instance_list_response = await InstanceService.retrieveInstanceList();
      if (instance_list_response.status !== ToolCallStatus.Success) {
        return {
          status: ToolCallStatus.Error,
          message: t("AgentChatPage.toolCall.launchInstance.fail"),
        };
      }
      let instance = instance_list_response.data.find(
        (inst) => inst.id === params.id
      );
      if (!instance) {
        return {
          status: ToolCallStatus.Error,
          message: t("AgentChatPage.toolCall.launchInstance.fail"),
        };
      }
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        action: "launch",
        instanceName: instance.name,
        instanceId: params.id,
      };
    }
    case "retrieve_launcher_config":
      return {
        launcherVersion: config.basicInfo.launcherVersion,
        globalGameConfig: config.globalGameConfig,
        localGameDirectories: config.localGameDirectories,
      };
    case "retrieve_java_info": {
      const javaListResp = await ConfigService.retrieveJavaList();
      if (javaListResp.status === ToolCallStatus.Success) {
        return javaListResp.data.map((j) => ({
          name: j.name,
          execPath: j.execPath,
          majorVersion: j.majorVersion,
        }));
      }
      return javaListResp;
    }
    case "fetch_news":
      const sources: NewsPostRequest[] = config.discoverSourceEndpoints.map(
        ([url, enabled]) => ({
          url,
          cursor: null,
          enabled,
        })
      );
      return await DiscoverService.fetchNewsPostSummaries(sources);

    // ── Write tools (prepare phase — validate + preview) ──────────────

    case "set_global_memory_size": {
      if (
        !params.sizeMB ||
        typeof params.sizeMB !== "number" ||
        params.sizeMB < 512
      ) {
        return {
          status: ToolCallStatus.Error,
          message: "sizeMB must be a number >= 512",
        };
      }
      const memResp = await UtilsService.retrieveMemoryInfo();
      if (
        memResp.status === ToolCallStatus.Success &&
        params.sizeMB > memResp.data.suggestedMaxAlloc
      ) {
        return {
          status: ToolCallStatus.Error,
          message: `sizeMB (${params.sizeMB}) exceeds suggested maximum (${memResp.data.suggestedMaxAlloc}MB)`,
        };
      }
      const gc = config.globalGameConfig;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: {
          autoMemAllocation: gc.performance.autoMemAllocation,
          maxMemAllocation: gc.performance.maxMemAllocation,
        },
        proposed: { autoMemAllocation: false, maxMemAllocation: params.sizeMB },
      };
    }

    case "set_global_java_path": {
      if (!params.execPath) {
        return { status: ToolCallStatus.Error, message: "Missing execPath" };
      }
      const javaResp = await ConfigService.retrieveJavaList();
      if (javaResp.status === ToolCallStatus.Success) {
        const valid = javaResp.data.some((j) => j.execPath === params.execPath);
        if (!valid) {
          return {
            status: ToolCallStatus.Error,
            message: `execPath not found in system Java list. Use retrieve_java_info to get valid paths.`,
          };
        }
      }
      const gc2 = config.globalGameConfig;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: { auto: gc2.gameJava.auto, execPath: gc2.gameJava.execPath },
        proposed: { auto: false, execPath: params.execPath },
      };
    }

    case "set_game_window_resolution": {
      if (!params.width || !params.height) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing width or height",
        };
      }
      if (params.width < 400 || params.height < 300) {
        return {
          status: ToolCallStatus.Error,
          message: "width >= 400, height >= 300",
        };
      }
      const res = config.globalGameConfig.gameWindow.resolution;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: { width: res.width, height: res.height },
        proposed: { width: params.width, height: params.height },
      };
    }

    case "set_instance_memory_size": {
      if (
        !params.instanceId ||
        !params.sizeMB ||
        typeof params.sizeMB !== "number" ||
        params.sizeMB < 512
      ) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing instanceId or invalid sizeMB",
        };
      }
      const instCfgResp = await InstanceService.retrieveInstanceGameConfig(
        params.instanceId
      );
      const curMem =
        instCfgResp.status === ToolCallStatus.Success ? instCfgResp.data : null;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: curMem
          ? {
              autoMemAllocation: curMem.performance.autoMemAllocation,
              maxMemAllocation: curMem.performance.maxMemAllocation,
            }
          : "using global config",
        proposed: { autoMemAllocation: false, maxMemAllocation: params.sizeMB },
      };
    }

    case "set_instance_java_path": {
      if (!params.instanceId || !params.execPath) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing instanceId or execPath",
        };
      }
      const javaResp2 = await ConfigService.retrieveJavaList();
      if (javaResp2.status === ToolCallStatus.Success) {
        const valid = javaResp2.data.some(
          (j) => j.execPath === params.execPath
        );
        if (!valid) {
          return {
            status: ToolCallStatus.Error,
            message: "execPath not found in system Java list",
          };
        }
      }
      const instCfgResp2 = await InstanceService.retrieveInstanceGameConfig(
        params.instanceId
      );
      const curJava =
        instCfgResp2.status === ToolCallStatus.Success
          ? instCfgResp2.data
          : null;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: curJava
          ? { auto: curJava.gameJava.auto, execPath: curJava.gameJava.execPath }
          : "using global config",
        proposed: { auto: false, execPath: params.execPath },
      };
    }

    case "set_instance_version_isolation": {
      if (!params.instanceId || typeof params.enabled !== "boolean") {
        return {
          status: ToolCallStatus.Error,
          message: "Missing instanceId or invalid enabled",
        };
      }
      const instCfgResp3 = await InstanceService.retrieveInstanceGameConfig(
        params.instanceId
      );
      const curIso =
        instCfgResp3.status === ToolCallStatus.Success
          ? instCfgResp3.data.versionIsolation
          : null;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: { versionIsolation: curIso },
        proposed: { versionIsolation: params.enabled },
      };
    }

    case "disable_instance_specific_config": {
      if (!params.instanceId) {
        return { status: ToolCallStatus.Error, message: "Missing instanceId" };
      }
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        current: "instance-specific config enabled",
        proposed: "follow global config",
      };
    }

    case "download_java": {
      if (!params.version) {
        return { status: ToolCallStatus.Error, message: "Missing version" };
      }
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        action: "download",
        version: params.version,
      };
    }

    case "toggle_mod": {
      if (
        !params.instanceId ||
        !params.filePath ||
        typeof params.enable !== "boolean"
      ) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing instanceId, filePath, or enable",
        };
      }
      const fileName = params.filePath.split(/[/\\]/).pop() || params.filePath;
      return {
        status: ToolCallStatus.PendingConfirmation,
        instruction:
          "Show the user the current vs proposed values and ask them to reply '确认' or 'ok' in the chat to apply the change.",
        action: params.enable ? "enable" : "disable",
        mod: fileName,
        filePath: params.filePath,
      };
    }

    default:
      return `Unknown function: ${name}`;
  }
}

/**
 * Commit phase for write tools — actually performs the config writes.
 */
export async function commitToolCall(
  name: string,
  params: Record<string, any>,
  context?: ToolExecutionContextData
): Promise<unknown> {
  switch (name) {
    case "launch_instance":
      if (!context) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing context for launch_instance",
        };
      }
      context.openSharedModal("launch", { instanceId: params.id });
      return {
        status: ToolCallStatus.Success,
        message: context.t("AgentChatPage.toolCall.launchInstance.success"),
      };

    case "create_instance":
      if (!context) {
        return {
          status: ToolCallStatus.Error,
          message: "Missing context for create_instance",
        };
      }
      return await InstanceService.createInstance(
        context.config.localGameDirectories[0],
        params.name,
        params.description,
        gameTypesToIcon[params.gameInfo.gameType],
        params.gameInfo,
        params.modLoaderInfo ?? defaultModLoaderResourceInfo,
        undefined,
        undefined,
        true
      );

    case "set_global_memory_size":
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.performance.autoMemAllocation",
        false
      );
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.performance.maxMemAllocation",
        params.sizeMB
      );
      return {
        status: ToolCallStatus.Success,
        message: `Global memory set to ${params.sizeMB}MB`,
      };

    case "set_global_java_path":
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.gameJava.auto",
        false
      );
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.gameJava.execPath",
        params.execPath
      );
      return {
        status: ToolCallStatus.Success,
        message: `Global Java path set to ${params.execPath}`,
      };

    case "set_game_window_resolution":
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.gameWindow.resolution.width",
        params.width
      );
      await ConfigService.updateLauncherConfig(
        "globalGameConfig.gameWindow.resolution.height",
        params.height
      );
      return {
        status: ToolCallStatus.Success,
        message: `Resolution set to ${params.width}x${params.height}`,
      };

    case "set_instance_memory_size":
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "useSpecGameConfig",
        true
      );
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "specGameConfig.performance.autoMemAllocation",
        false
      );
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "specGameConfig.performance.maxMemAllocation",
        params.sizeMB
      );
      return {
        status: ToolCallStatus.Success,
        message: `Instance memory set to ${params.sizeMB}MB`,
      };

    case "set_instance_java_path":
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "useSpecGameConfig",
        true
      );
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "specGameConfig.gameJava.auto",
        false
      );
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "specGameConfig.gameJava.execPath",
        params.execPath
      );
      return {
        status: ToolCallStatus.Success,
        message: `Instance Java path set to ${params.execPath}`,
      };

    case "set_instance_version_isolation":
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "useSpecGameConfig",
        true
      );
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "specGameConfig.versionIsolation",
        params.enabled
      );
      return {
        status: ToolCallStatus.Success,
        message: `Instance version isolation set to ${params.enabled}`,
      };

    case "disable_instance_specific_config":
      await InstanceService.updateInstanceConfig(
        params.instanceId,
        "useSpecGameConfig",
        false
      );
      return {
        status: ToolCallStatus.Success,
        message: "Instance now follows global config",
      };

    case "download_java":
      await ConfigService.downloadMojangJava(params.version);
      return {
        status: ToolCallStatus.Success,
        message: `Java ${params.version} download started`,
      };

    case "toggle_mod":
      await InstanceService.toggleModByExtension(
        params.filePath,
        params.enable
      );
      return {
        status: ToolCallStatus.Success,
        message: `Mod ${params.enable ? "enabled" : "disabled"}: ${params.filePath}`,
      };

    default:
      return {
        status: ToolCallStatus.Error,
        message: `Unknown write tool: ${name}`,
      };
  }
}

/**
 * Detect if a user message is a confirmation for a pending write operation.
 */
export function isConfirmationMessage(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length > 50) return false;
  return /^(确认|执行吧?|好的?|可以|没问题|改吧|是的?|行|嗯|继续|同意|对|yes|ok|sure|confirm|go\s*ahead|do\s*it|y|👍)/i.test(
    trimmed
  );
}

/**
 * Detect if a user message is a cancellation for a pending write operation.
 */
export function isCancellationMessage(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length > 50) return false;
  return /^(取消|不用了?|算了|停止|别执行|先不要|不改了?|no|cancel|stop|abort|n|✖|x)$/i.test(
    trimmed
  );
}
