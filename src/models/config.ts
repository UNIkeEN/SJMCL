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
  runCount: -1,
  appearance: {
    theme: {
      primaryColor: "blue",
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
      selectedType: "HTTP",
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
