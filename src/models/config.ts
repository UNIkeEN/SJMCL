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
      args: string;
      javaPermanentGenerationSpace: number;
      environmentVariable: string;
    };
    workaround: {
      noJvmArgs: boolean;
      gameFileValidatePolicy: string;
      dontCheckJvmValidity: boolean;
      dontPatchNatives: boolean;
      useNativeGlfw: boolean;
      useNativeOpenal: boolean;
    };
  };
}

export interface GameDirectory {
  name: string;
  dir: string;
}

export enum LLMProviderType {
  OpenAICompatible = "openAiCompatible",
  Anthropic = "anthropic",
  Gemini = "gemini",
}

export interface LLMParametersConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  providerType: LLMProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  parameters: LLMParametersConfig;
}

export interface LauncherConfig {
  basicInfo: {
    launcherVersion: string;
    platform: string;
    arch: string;
    osType: string;
    platformVersion: string;
    isPortable: boolean;
    isChinaMainlandIp: boolean;
    allowFullLoginFeature: boolean;
  };
  mocked: boolean;
  runCount: number;
  appearance: {
    theme: {
      primaryColor: string;
      colorMode: "light" | "dark" | "system";
      useLiquidGlassDesign: boolean;
      headNavStyle: string;
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
      discoverPage: boolean;
      instancesNavType: string;
      launchPageQuickSwitch: boolean;
      resourceTranslation: boolean;
      skipFirstScreenOptions: boolean;
    };
    advanced: {
      autoPurgeLauncherLogs: boolean;
    };
  };
  globalGameConfig: GameConfig;
  intelligence: {
    enabled: boolean;
    activeProviderId: string;
    providers: LLMProviderConfig[];
  };
  localGameDirectories: GameDirectory[];
  discoverSourceEndpoints: string[];
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
      viewType: string;
    };
    gameVersionSelector: {
      gameTypes: string[];
    };
    instanceModsPage: {
      accordionStates: boolean[];
    };
    instanceResourcepackPage: {
      accordionStates: boolean[];
    };
    instanceWorldsPage: {
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
      width: 1280,
      height: 720,
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
      args: "",
      javaPermanentGenerationSpace: 0,
      environmentVariable: "",
    },
    workaround: {
      noJvmArgs: false,
      gameFileValidatePolicy: "full",
      dontCheckJvmValidity: false,
      dontPatchNatives: false,
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
    isPortable: false,
    isChinaMainlandIp: false,
    allowFullLoginFeature: false,
  },
  mocked: true,
  runCount: -1,
  appearance: {
    theme: {
      primaryColor: "blue",
      colorMode: "light",
      useLiquidGlassDesign: false,
      headNavStyle: "standard",
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
      discoverPage: false,
      instancesNavType: "instance",
      launchPageQuickSwitch: true,
      resourceTranslation: true,
      skipFirstScreenOptions: false,
    },
    advanced: {
      autoPurgeLauncherLogs: true,
    },
  },
  globalGameConfig: defaultGameConfig,
  intelligence: {
    enabled: false,
    activeProviderId: "",
    providers: [],
  },
  localGameDirectories: [{ name: "Current", dir: ".minecraft/" }],
  discoverSourceEndpoints: [
    "https://mc.sjtu.cn/api-sjmcl/article",
    "https://mc.sjtu.cn/api-sjmcl/article/mua",
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
      viewType: "list",
    },
    gameVersionSelector: {
      gameTypes: ["release"],
    },
    instanceModsPage: {
      accordionStates: [true, true],
    },
    instanceResourcepackPage: {
      accordionStates: [true, true],
    },
    instanceWorldsPage: {
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

export const defaultLLMParameters = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

export const defaultLLMProviderConfig: LLMProviderConfig = {
  id: "",
  name: "",
  enabled: true,
  priority: 0,
  providerType: LLMProviderType.OpenAICompatible,
  baseUrl: "",
  apiKey: "",
  model: "",
  parameters: { ...defaultLLMParameters },
};
