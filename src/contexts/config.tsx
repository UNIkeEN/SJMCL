import { ColorModeScript, useColorMode } from "@chakra-ui/react";
import i18n from "i18next";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import { localeResources } from "@/locales";
import {
  LauncherConfig,
  VersionMetaInfo,
  defaultConfig,
  defaultVersionMetaInfo,
} from "@/models/config";
import { JavaInfo } from "@/models/system-info";
import { ConfigService } from "@/services/config";
import { updateByKeyPath } from "@/utils/partial";

interface LauncherConfigContextType {
  config: LauncherConfig;
  setConfig: React.Dispatch<React.SetStateAction<LauncherConfig>>;
  update: (path: string, value: any) => void;
  isZh: boolean; // value shortcut, true if language is zh-Hans / zh-Hant / lzh
  newerVersion: VersionMetaInfo;
  // other shared data associated with the launcher config.
  getJavaInfos: (sync?: boolean) => JavaInfo[] | undefined;
  // shared service handlers
  handleCheckLauncherUpdate: () => Promise<VersionMetaInfo>;
}

const LauncherConfigContext = createContext<
  LauncherConfigContextType | undefined
>(undefined);

export const LauncherConfigContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();

  const [config, setConfig] = useState<LauncherConfig>(defaultConfig);
  const language = config.general.general.language;
  const isZh = language.startsWith("zh") || language === "lzh";
  const userSelectedColorMode = config.appearance.theme.colorMode;

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>();
  const [newerVersion, setNewerVersion] = useState<VersionMetaInfo>(
    defaultVersionMetaInfo
  );

  const handleRetrieveLauncherConfig = useCallback(() => {
    ConfigService.retrieveLauncherConfig().then((response) => {
      if (response.status === "success") {
        setConfig(response.data);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [setConfig, toast]);

  // from frontend to call backend update
  const handleUpdateLauncherConfig = (path: string, value: any) => {
    // save to the backend
    ConfigService.updateLauncherConfig(path, value).then((response) => {
      // if success, backend will emit signal, the logic below will be executed
      if (response.status !== "success") {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  };

  // listen from backend to update frontend's config state
  const handleConfigPartialUpdate = useCallback((payload: any) => {
    const { path, value } = payload;
    setConfig((prevConfig) => {
      const newConfig = { ...prevConfig };
      updateByKeyPath(newConfig, path, JSON.parse(value));
      return newConfig;
    });
  }, []);

  // retrieve config after partial update listener is set, to avoid missing updates during the initial loading phase. (#1615)
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void ConfigService.onConfigPartialUpdate(handleConfigPartialUpdate)
      .then((cleanup) => {
        unlisten = cleanup;
        if (cancelled) {
          unlisten();
          return;
        }

        handleRetrieveLauncherConfig();
      })
      .catch(() => {
        handleRetrieveLauncherConfig();
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handleConfigPartialUpdate, handleRetrieveLauncherConfig]);

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang =
      localeResources[language]?.htmlLang || language;
  }, [language]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyColorMode = () => {
      let target: "light" | "dark";
      if (userSelectedColorMode === "system") {
        target = media.matches ? "dark" : "light";
      } else {
        target = userSelectedColorMode;
      }
      if (target !== colorMode) toggleColorMode();
    };

    applyColorMode();

    if (userSelectedColorMode === "system") {
      media.addEventListener("change", applyColorMode);
      return () => media.removeEventListener("change", applyColorMode);
    }
  }, [userSelectedColorMode, colorMode, toggleColorMode]);

  // java list cache and retriever
  const handleRetrieveJavaList = useCallback(() => {
    ConfigService.retrieveJavaList().then((response) => {
      if (response.status === "success") {
        setJavaInfos(response.data);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
        setJavaInfos([]);
      }
    });
  }, [toast]);

  const getJavaInfos = useGetState(javaInfos, handleRetrieveJavaList);

  // check launcher update
  const handleCheckLauncherUpdate =
    useCallback(async (): Promise<VersionMetaInfo> => {
      const response = await ConfigService.checkLauncherUpdate();
      if (response.status === "success") {
        setNewerVersion(
          response.data.version == "up2date"
            ? defaultVersionMetaInfo
            : response.data
        );
        return response.data;
      }
      return defaultVersionMetaInfo;
    }, []);

  useEffect(() => {
    handleCheckLauncherUpdate();
  }, [handleCheckLauncherUpdate]);

  return (
    <LauncherConfigContext.Provider
      value={{
        config,
        setConfig,
        update: handleUpdateLauncherConfig,
        isZh,
        newerVersion,
        getJavaInfos,
        handleCheckLauncherUpdate,
      }}
    >
      <ColorModeScript initialColorMode={userSelectedColorMode} />
      {children}
    </LauncherConfigContext.Provider>
  );
};

export const useLauncherConfig = (): LauncherConfigContextType => {
  const context = useContext(LauncherConfigContext);
  if (!context) {
    throw new Error(
      "useLauncherConfig must be used within a LauncherConfigContextProvider"
    );
  }
  return context;
};
