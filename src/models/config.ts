export interface GameConfig {
  performance: {
    gameWindowResolution: {
      width: number;
      height: number;
      fullscreen: boolean;
    };
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
  states: {
    accountsPage: {
      viewType: string;
    };
    allGamesPage: {
      viewType: string;
    };
  };
}

export const defaultGameConfig: GameConfig = {
  performance: {
    gameWindowResolution: {
      width: 1280,
      height: 720,
      fullscreen: false,
    },
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
  states: {
    accountsPage: {
      viewType: "grid",
    },
    allGamesPage: {
      viewType: "list",
    },
  },
};
