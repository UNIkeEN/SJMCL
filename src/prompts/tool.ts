import { ToolDefinition } from "@/models/intelligence/tool-call";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "retrieve_game_version_list",
    category: "query",
    description: {
      "zh-Hans": "获取所有的游戏版本信息",
      en: "Get all game versions",
    },
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["release", "snapshot", "old_beta", "april_fools"],
        },
      },
      required: ["type"],
    },
    usageNotes: {
      "zh-Hans": [
        "包含正式版、快照版、旧版、愚人节特别版",
        "每个游戏版本信息包含 id, gameType, releaseTime, url 字段",
      ],
    },
  },
  {
    name: "retrieve_mod_loader_list_by_game_version",
    category: "query",
    description: {
      "zh-Hans": "获取指定游戏版本的模组加载器版本列表",
      en: "Get the mod loader version list for a specific game version",
    },
    parameters: {
      type: "object",
      properties: {
        version: { type: "string" },
        loaderType: {
          type: "string",
          enum: ["Fabric", "Forge", "NeoForge"],
        },
      },
      required: ["version", "loaderType"],
    },
    usageNotes: {
      "zh-Hans": [
        "version 必须是有效的游戏版本，可以从 retrieve_game_version_list 中获取",
        "每个模组加载器版本包含 loaderType, version, description, stable, branch 字段",
      ],
      en: [
        '"version" must be a valid game version, retrieved from retrieve_game_version_list',
      ],
    },
  },
  {
    name: "create_instance",
    category: "write",
    requiresConfirmation: true,
    description: {
      "zh-Hans": "创建一个新的游戏实例",
      en: "Create a new game instance",
    },
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        gameInfo: {
          type: "object",
          properties: {
            gameType: {
              type: "string",
              enum: ["release", "snapshot", "old_beta", "april_fools"],
            },
            id: { type: "string" },
            releaseTime: { type: "string" },
            url: { type: "string" },
          },
        },
        modLoaderInfo: {
          type: "object",
          optional: true,
          properties: {
            loaderType: {
              type: "string",
              enum: ["Fabric", "Forge", "NeoForge"],
            },
            version: { type: "string" },
            description: { type: "string" },
            stable: { type: "boolean" },
            branch: { type: "string" },
          },
        },
      },
      required: ["name", "description", "gameInfo"],
    },
    usageNotes: {
      "zh-Hans": [
        "gameInfo 通过 fetch_game_version_list 获取",
        "用户没有需要模组加载器时，modLoaderInfo 可忽略；而当指定模组加载器时，通过 fetch_mod_loader_list_by_game_version 获取",
      ],
      en: [
        "gameInfo must be fetched from fetch_game_version_list, and modLoaderInfo can be ignored if not provided, otherwise it must be fetched from fetch_mod_loader_list_by_game_version",
      ],
    },
  },
  {
    name: "retrieve_instance_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家的所有游戏实例",
      en: "Get all game instances of the player",
    },
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    usageNotes: {
      "zh-Hans": [
        "在 data 中，每个实例包含 id、name、version、等字段，其中 name 方便用户选择，id 用作接下来的一系列实例操作的参数",
      ],
      en: [
        "in data, each instance contains id, name, version, etc., where name is convenient for users to choose, and id is convenient for subsequent launching",
      ],
    },
  },
  {
    name: "retrieve_instance_game_config",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的游戏配置",
      en: "Get the game configuration of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": [
        "id 必须从 `retrieve_instance_list` 的返回值中获取",
        "如果实例没有特殊设置，应该从启动器配置 `retrieve_launcher_config` 中获取",
      ],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_world_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有世界",
      en: "Get the world list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": [
        "id 必须从 `retrieve_instance_list` 的返回值中获取",
        // NOTE: original prompt references `retrieve_instance_world_info` which should be
        // `retrieve_instance_world_details` — preserving the original text for behavior equivalence
        "在 data 中，每个世界包含 name 字段，其中 name 可以用于 `retrieve_instance_world_info` 的参数",
      ],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_world_details",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的某个世界的信息",
      en: "Get the world details of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        worldName: { type: "string" },
      },
      required: ["instanceId", "worldName"],
    },
    usageNotes: {
      "zh-Hans": [
        "instanceId 必须从 `retrieve_instance_list` 的返回值中获取，worldName 必须从 `retrieve_instance_world_list` 的返回值中获取",
      ],
      en: [
        "instanceId must be retrieved from `retrieve_instance_list` and worldName must be retrieved from `retrieve_instance_world_list`",
      ],
    },
  },
  {
    name: "retrieve_instance_game_server_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有服务器信息",
      en: "Get the game server list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_local_mod_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有本地模组信息",
      en: "Get the local mod list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_resource_pack_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有资源包信息",
      en: "Get the resource pack list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_server_resource_pack_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有服务器资源包信息",
      en: "Get the server resource pack list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_schematic_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有方块集合信息",
      en: "Get the schematic list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "retrieve_instance_shader_pack_list",
    category: "query",
    description: {
      "zh-Hans": "获取玩家在实例中的所有着色器包信息",
      en: "Get the shader pack list of the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "launch_instance",
    category: "write",
    requiresConfirmation: true,
    description: {
      "zh-Hans": "启动游戏",
      en: "Launch the instance",
    },
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    usageNotes: {
      "zh-Hans": ["id 必须从 `retrieve_instance_list` 的返回值中获取"],
      en: ["id must be retrieved from `retrieve_instance_list`"],
    },
  },
  {
    name: "fetch_news",
    category: "query",
    description: {
      "zh-Hans": "获取社团相关的新闻",
      en: "Fetch news related to the club",
    },
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    usageNotes: {
      "zh-Hans": [
        "每个新闻包含 title、abstract、keywords、imageSrc、source、createAt、link 等字段",
      ],
      en: [
        "each news contains title、abstract、keywords、imageSrc、source、createAt、link...",
      ],
    },
  },
  {
    name: "retrieve_launcher_config",
    category: "query",
    description: {
      "zh-Hans": "获取启动器配置",
      en: "Get launcher configuration",
    },
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    usageNotes: {
      "zh-Hans": ["包含启动器版本、内存大小等信息"],
      en: ["including launcher version, java path, memory size, etc."],
    },
  },
  {
    name: "retrieve_java_info",
    category: "query",
    description: {
      "zh-Hans": "获取 Java 信息",
      en: "Get Java information",
    },
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    usageNotes: {
      "zh-Hans": ["包含 Java 版本、路径等信息"],
      en: ["including Java version, path, etc."],
    },
  },

  // ── Write tools ─────────────────────────────────────────────────────

  {
    name: "download_java",
    category: "write",
    description: {
      "zh-Hans": "下载 Mojang 官方 Java 运行时",
      en: "Download Mojang official Java runtime",
    },
    parameters: {
      type: "object",
      properties: {
        version: { type: "string" },
      },
      required: ["version"],
    },
    usageNotes: {
      "zh-Hans": [
        'version 为 Java 大版本号，如 "java-runtime-gamma"（Java 17）或 "java-runtime-delta"（Java 21）',
      ],
      en: [
        'version is the Java runtime component name, e.g. "java-runtime-gamma" (Java 17) or "java-runtime-delta" (Java 21)',
      ],
    },
    requiresConfirmation: true,
  },

  {
    name: "set_global_memory_size",
    category: "write",
    description: {
      "zh-Hans": "设置全局最大内存分配",
      en: "Set global maximum memory allocation",
    },
    parameters: {
      type: "object",
      properties: {
        sizeMB: { type: "number" },
      },
      required: ["sizeMB"],
    },
    usageNotes: {
      "zh-Hans": ["sizeMB 单位为 MB，不应超过系统建议的最大值"],
      en: [
        "sizeMB is in megabytes, should not exceed system suggested maximum",
      ],
    },
    requiresConfirmation: true,
  },
  {
    name: "set_global_java_path",
    category: "write",
    description: {
      "zh-Hans": "设置全局 Java 路径",
      en: "Set global Java executable path",
    },
    parameters: {
      type: "object",
      properties: {
        execPath: { type: "string" },
      },
      required: ["execPath"],
    },
    usageNotes: {
      "zh-Hans": ["execPath 必须来自 `retrieve_java_info` 返回的列表"],
      en: ["execPath must be from the list returned by `retrieve_java_info`"],
    },
    requiresConfirmation: true,
  },
  {
    name: "set_game_window_resolution",
    category: "write",
    description: {
      "zh-Hans": "设置全局游戏窗口分辨率",
      en: "Set global game window resolution",
    },
    parameters: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["width", "height"],
    },
    usageNotes: {
      "zh-Hans": ["width >= 400，height >= 300"],
      en: ["width >= 400, height >= 300"],
    },
    requiresConfirmation: true,
  },
  {
    name: "set_instance_memory_size",
    category: "write",
    description: {
      "zh-Hans": "设置实例专属最大内存分配",
      en: "Set instance-specific maximum memory allocation",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        sizeMB: { type: "number" },
      },
      required: ["instanceId", "sizeMB"],
    },
    usageNotes: {
      "zh-Hans": [
        "instanceId 必须从 `retrieve_instance_list` 获取",
        "sizeMB 单位为 MB",
      ],
      en: [
        "instanceId must be from `retrieve_instance_list`",
        "sizeMB is in megabytes",
      ],
    },
    requiresConfirmation: true,
  },
  {
    name: "set_instance_java_path",
    category: "write",
    description: {
      "zh-Hans": "设置实例专属 Java 路径",
      en: "Set instance-specific Java executable path",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        execPath: { type: "string" },
      },
      required: ["instanceId", "execPath"],
    },
    usageNotes: {
      "zh-Hans": [
        "instanceId 必须从 `retrieve_instance_list` 获取",
        "execPath 必须来自 `retrieve_java_info`",
      ],
      en: [
        "instanceId must be from `retrieve_instance_list`",
        "execPath must be from `retrieve_java_info`",
      ],
    },
    requiresConfirmation: true,
  },
  {
    name: "set_instance_version_isolation",
    category: "write",
    description: {
      "zh-Hans": "设置实例版本隔离",
      en: "Set instance version isolation",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["instanceId", "enabled"],
    },
    usageNotes: {
      "zh-Hans": ["instanceId 必须从 `retrieve_instance_list` 获取"],
      en: ["instanceId must be from `retrieve_instance_list`"],
    },
    requiresConfirmation: true,
  },
  {
    name: "disable_instance_specific_config",
    category: "write",
    description: {
      "zh-Hans": "让实例重新跟随全局配置",
      en: "Disable instance-specific config, follow global settings",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
      },
      required: ["instanceId"],
    },
    usageNotes: {
      "zh-Hans": ["instanceId 必须从 `retrieve_instance_list` 获取"],
      en: ["instanceId must be from `retrieve_instance_list`"],
    },
    requiresConfirmation: true,
  },

  // ── Repair tools (Phase 4) ─────────────────────────────────────────

  {
    name: "toggle_mod",
    category: "repair",
    description: {
      "zh-Hans": "启用或禁用指定模组",
      en: "Enable or disable a specific mod",
    },
    parameters: {
      type: "object",
      properties: {
        instanceId: { type: "string" },
        filePath: { type: "string" },
        enable: { type: "boolean" },
      },
      required: ["instanceId", "filePath", "enable"],
    },
    usageNotes: {
      "zh-Hans": [
        "instanceId 必须从 `retrieve_instance_list` 获取",
        "filePath 必须从 `retrieve_instance_local_mod_list` 获取",
        "启用/禁用通过修改文件扩展名实现，操作可逆",
      ],
      en: [
        "instanceId must be from `retrieve_instance_list`",
        "filePath must be from `retrieve_instance_local_mod_list`",
        "enable/disable toggles the file extension, fully reversible",
      ],
    },
    requiresConfirmation: true,
  },
];
