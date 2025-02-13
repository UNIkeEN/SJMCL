export interface GameConfig {
  gameServer: {
    autoJoinGameServer: {
      enabled: boolean;
      gameServer: string;
    };
  };
  gameWindow: {
    gameWindowResolution: {
      width: number;
      height: number;
      fullscreen: boolean;
    };
    gameWindowTitle: string;
    gameWindowCustomInfo: string;
  };
  performance: {
    autoMemAllocation: boolean;
    minMemAllocation: number;
    processPriority: string;
  };
  versionIsolation: {
    enabled: boolean;
    isolationStrategy: string;
  };
  launcherVisibility: string;
  displayGameLog: boolean;
  advancedOptions: {
    enabled: boolean;
  };
}

export interface LauncherConfig {
  version: string;
  mocked: boolean;
  appearance: {
    theme: {
      primaryColor: string;
      headNavStyle: string;
    };
    background: {
      presetChoice: string;
    };
  };
  download: {
    source: {
      strategy: string;
    };
    download: {
      autoConcurrent: boolean;
      concurrentCount: number;
      enableSpeedLimit: boolean;
      speedLimitValue: number;
    };
    cache: {
      directory: string;
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
  localGameDirectories: string[];
  globalGameConfig: GameConfig;
  page: {
    accounts: {
      viewType: string;
    };
    games: {
      viewType: string;
    };
  };
}

export const defaultGameConfig: GameConfig = {
  gameServer: {
    autoJoinGameServer: {
      enabled: false,
      gameServer: "",
    },
  },
  gameWindow: {
    gameWindowResolution: {
      width: 1920,
      height: 1080,
      fullscreen: false,
    },
    gameWindowTitle: "",
    gameWindowCustomInfo: "",
  },
  performance: {
    autoMemAllocation: true,
    minMemAllocation: 1024,
    processPriority: "middle",
  },
  versionIsolation: {
    enabled: true,
    isolationStrategy: "full",
  },
  launcherVisibility: "start-close",
  displayGameLog: false,
  advancedOptions: {
    enabled: false,
  },
};

export const defaultConfig: LauncherConfig = {
  version: "dev",
  mocked: true,
  appearance: {
    theme: {
      primaryColor: "blue",
      headNavStyle: "standard",
    },
    background: {
      presetChoice: "Jokull",
    },
  },
  download: {
    source: {
      strategy: "auto",
    },
    download: {
      autoConcurrent: true,
      concurrentCount: 64,
      enableSpeedLimit: false,
      speedLimitValue: 1024,
    },
    cache: {
      directory: "/mock/path/to/cache/",
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
  localGameDirectories: [".minecraft/"],
  globalGameConfig: defaultGameConfig,
  page: {
    accounts: {
      viewType: "grid",
    },
    games: {
      viewType: "list",
    },
  },
};
