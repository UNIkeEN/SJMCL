import type { HomeWidgetStateTuple } from "@/models/extension";

export interface GameConfig {
  gameJava: {
    auto: boolean;
    execPath: string;
  };
  gameServer: {
    autoJoin: boolean;
    serverUrl: string;
  };
  gameWindow: {
    resolution: {
      width: number;
      height: number;
      fullscreen: boolean;
    };
    customTitle: string;
    customInfo: string;
  };
  performance: {
    autoMemAllocation: boolean;
    maxMemAllocation: number;
    processPriority: string;
  };
  versionIsolation: boolean;
  launcherVisibility: string;
  displayGameLog: boolean;
  advancedOptions: {
    enabled: boolean;
  };
  advanced: {
    customCommands: {
      minecraftArgument: string;
      precallCommand: string;
      wrapperLauncher: string;
      postExitCommand: string;
    };
    jvm: {
      garbageCollector: string;
      javaPermanentGenerationSpace: number;
      environmentVariable: string;
      args: string;
    };
    workaround: {
      noJvmArgs: boolean;
      gameFileValidatePolicy: string;
      dontCheckJvmValidity: boolean;
      dontPatchNatives: boolean;
      useLwjglUnsafeAgent: boolean;
      useNativeGlfw: boolean;
      useNativeOpenal: boolean;
    };
  };
}

export interface GameDirectory {
  name: string;
  dir: string;
}

export interface LauncherConfig {
  basicInfo: {
    launcherVersion: string;
    platform: string;
    arch: string;
    osType: string;
    platformVersion: string;
    exeSha256: string;
    isPortable: boolean;
    isExePathAvailable: boolean;
    isChinaMainlandIp: boolean;
    allowFullLoginFeature: boolean;
  };
  mocked: boolean;
  runCount: number;
  lastRunExitedNormally: boolean;
  appearance: {
    theme: {
      primaryColor: string;
      colorMode: "light" | "dark" | "system";
      useLiquidGlassDesign: boolean;
      headNavStyle: "standard" | "simplified" | "adaptive";
    };
    font: {
      fontFamily: string;
      fontSize: number;
    };
    background: {
      choice: string;
      randomCustom: boolean;
      autoDarken: boolean;
    };
    accessibility: {
      invertColors: boolean;
      enhanceContrast: boolean;
    };
  };
  download: {
    source: {
      strategy: string;
    };
    transmission: {
      autoConcurrent: boolean;
      concurrentCount: number;
      enableSpeedLimit: boolean;
      speedLimitValue: number;
    };
    cache: {
      directory: string;
    };
    proxy: {
      enabled: boolean;
      selectedType: string;
      host: string;
      port: number;
    };
  };
  general: {
    general: {
      language: string;
    };
    functionality: {
      discoverPage: string;
      instancesNavType: string;
      launchPageQuickSwitch: boolean;
      autoDownloadJava: boolean;
      resourceTranslation: boolean;
      translatedFilenamePrefix: boolean;
      skipFirstScreenOptions: boolean;
    };
    advanced: {
      autoPurgeLauncherLogs: boolean;
    };
  };
  intelligence: {
    mcpServer: {
      launcher: {
        enabled: boolean;
        port: number;
      };
    };
  };
  extension: {
    enabled: string[];
    homeWidgetState: HomeWidgetStateTuple[];
  };
  localGameDirectories: GameDirectory[];
  globalGameConfig: GameConfig;
  discoverSourceEndpoints: [string, boolean][];
  extraJavaPaths: string[];
  suppressedDialogs: string[];
  states: {
    shared: {
      selectedPlayerId: string;
      selectedInstanceId: string;
    };
    accountsPage: {
      viewType: string;
    };
    allInstancesPage: {
      sortBy: string;
      viewType: string;
    };
    gameVersionSelector: {
      gameTypes: string[];
    };
    instanceModsPage: {
      accordionStates: boolean[];
    };
    instanceResourcePacksPage: {
      accordionStates: boolean[];
    };
    instanceWorldsPage: {
      accordionStates: boolean[];
    };
    instanceShaderPacksPage: {
      accordionStates: boolean[];
    };
  };
}

export const defaultGameConfig: GameConfig = {
  gameJava: {
    auto: true,
    execPath: "",
  },
  gameServer: {
    autoJoin: false,
    serverUrl: "",
  },
  gameWindow: {
    resolution: {
      width: 854,
      height: 480,
      fullscreen: false,
    },
    customTitle: "",
    customInfo: "",
  },
  performance: {
    autoMemAllocation: true,
    maxMemAllocation: 1024,
    processPriority: "normal",
  },
  versionIsolation: true,
  launcherVisibility: "startHidden",
  displayGameLog: false,
  advancedOptions: {
    enabled: false,
  },
  advanced: {
    customCommands: {
      minecraftArgument: "",
      precallCommand: "",
      wrapperLauncher: "",
      postExitCommand: "",
    },
    jvm: {
      garbageCollector: "auto",
      javaPermanentGenerationSpace: 0,
      environmentVariable: "",
      args: "",
    },
    workaround: {
      noJvmArgs: false,
      gameFileValidatePolicy: "normal",
      dontCheckJvmValidity: false,
      dontPatchNatives: false,
      useLwjglUnsafeAgent: true,
      useNativeGlfw: false,
      useNativeOpenal: false,
    },
  },
};

export const defaultConfig: LauncherConfig = {
  basicInfo: {
    launcherVersion: "dev",
    platform: "",
    arch: "",
    osType: "",
    platformVersion: "",
    exeSha256: "",
    isPortable: false,
    isExePathAvailable: true,
    isChinaMainlandIp: false,
    allowFullLoginFeature: false,
  },
  mocked: true,
  runCount: -1,
  lastRunExitedNormally: true,
  appearance: {
    theme: {
      primaryColor: "blue",
      colorMode: "light",
      useLiquidGlassDesign: false,
      headNavStyle: "adaptive",
    },
    font: {
      fontFamily: "%built-in",
      fontSize: 100,
    },
    background: {
      choice: "%built-in:Jokull",
      randomCustom: false,
      autoDarken: true,
    },
    accessibility: {
      invertColors: false,
      enhanceContrast: false,
    },
  },
  download: {
    source: {
      strategy: "auto",
    },
    transmission: {
      autoConcurrent: true,
      concurrentCount: 64,
      enableSpeedLimit: false,
      speedLimitValue: 1024,
    },
    cache: {
      directory: "/mock/path/to/cache/",
    },
    proxy: {
      enabled: false,
      selectedType: "http",
      host: "127.0.0.1",
      port: 80,
    },
  },
  general: {
    general: {
      language: "zh-Hans",
    },
    functionality: {
      discoverPage: "on",
      instancesNavType: "instance",
      launchPageQuickSwitch: true,
      autoDownloadJava: true,
      resourceTranslation: true,
      translatedFilenamePrefix: true,
      skipFirstScreenOptions: false,
    },
    advanced: {
      autoPurgeLauncherLogs: true,
    },
  },
  intelligence: {
    mcpServer: {
      launcher: {
        enabled: true,
        port: 18970,
      },
    },
  },
  extension: {
    enabled: [],
    homeWidgetState: [],
  },
  localGameDirectories: [{ name: "Current", dir: ".minecraft/" }],
  globalGameConfig: defaultGameConfig,
  discoverSourceEndpoints: [
    ["https://mc.sjtu.cn/api-sjmcl/article", true],
    ["https://mc.sjtu.cn/api-sjmcl/article/mua", true],
  ],
  extraJavaPaths: [],
  suppressedDialogs: [],
  states: {
    shared: {
      selectedPlayerId: "",
      selectedInstanceId: "",
    },
    accountsPage: {
      viewType: "grid",
    },
    allInstancesPage: {
      sortBy: "versionAsc",
      viewType: "list",
    },
    gameVersionSelector: {
      gameTypes: ["release"],
    },
    instanceModsPage: {
      accordionStates: [false, true],
    },
    instanceResourcePacksPage: {
      accordionStates: [true, true],
    },
    instanceWorldsPage: {
      accordionStates: [true, true],
    },
    instanceShaderPacksPage: {
      accordionStates: [true, true],
    },
  },
};

export interface VersionMetaInfo {
  version: string;
  fileName: string;
  releaseNotes?: string;
  publishedAt?: string;
}

// empty release meta info indicating up-to-date or error.
export const defaultVersionMetaInfo: VersionMetaInfo = {
  version: "",
  fileName: "",
};
