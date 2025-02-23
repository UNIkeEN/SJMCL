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
    minMemAllocation: number;
    processPriority: string;
  };
  versionIsolation: boolean;
  launcherVisibility: string;
  displayGameLog: boolean;
  advancedOptions: {
    enabled: boolean;
  };
}
export interface GameDirectory {
  name: string;
  dir: string;
}

export interface LauncherConfig {
  version: string;
  mocked: boolean;
  runCount: number;
  appearance: {
    theme: {
      primaryColor: string;
      colorMode: "light" | "dark" | "system";
      headNavStyle: string;
    };
    background: {
      choice: string;
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
    optionalFunctions: {
      discover: boolean;
    };
  };
  localGameDirectories: GameDirectory[];
  globalGameConfig: GameConfig;
  discoverSourceEndpoints: string[];
  states: {
    accountsPage: {
      viewType: string;
    };
    allGamesPage: {
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
    minMemAllocation: 1024,
    processPriority: "middle",
  },
  versionIsolation: true,
  launcherVisibility: "start-close",
  displayGameLog: false,
  advancedOptions: {
    enabled: false,
  },
};

export const defaultConfig: LauncherConfig = {
  version: "dev",
  mocked: true,
  runCount: -1,
  appearance: {
    theme: {
      primaryColor: "blue",
      colorMode: "light",
      headNavStyle: "standard",
    },
    background: {
      choice: "%built-in:Jokull",
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
    optionalFunctions: {
      discover: false,
    },
  },
  localGameDirectories: [{ name: "Current", dir: ".minecraft/" }],
  globalGameConfig: defaultGameConfig,
  discoverSourceEndpoints: ["https://mc.sjtu.cn/api-sjmcl/article"],
  states: {
    accountsPage: {
      viewType: "grid",
    },
    allGamesPage: {
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
