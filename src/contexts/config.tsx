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
import { LauncherConfig, defaultConfig } from "@/models/config";
import { JavaInfo } from "@/models/system-info";
import { ConfigService } from "@/services/config";
import { updateByKeyPath } from "@/utils/partial";

interface LauncherConfigContextType {
  config: LauncherConfig;
  setConfig: React.Dispatch<React.SetStateAction<LauncherConfig>>;
  update: (path: string, value: any) => void;
  // other shared data associated with the launcher config.
  getJavaInfos: (sync?: boolean) => JavaInfo[] | undefined;
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
  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>();

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

  useEffect(() => {
    handleRetrieveLauncherConfig();
  }, [handleRetrieveLauncherConfig]);

  useEffect(() => {
    i18n.changeLanguage(config.general.general.language);
  }, [config.general.general.language]);

  useEffect(() => {
    if (config.appearance.theme.colorMode !== "system") {
      if (config.appearance.theme.colorMode !== colorMode) {
        toggleColorMode();
      }
    }
  }, [colorMode, config.appearance.theme.colorMode, toggleColorMode]);

  const handleUpdateLauncherConfig = (path: string, value: any) => {
    const newConfig = { ...config };
    updateByKeyPath(newConfig, path, value);

    // Save to the backend
    ConfigService.updateLauncherConfig(path, value).then((response) => {
      if (response.status === "success") {
        setConfig(newConfig); // update frontend state if successful
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  };

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

  return (
    <LauncherConfigContext.Provider
      value={{
        config,
        setConfig,
        update: handleUpdateLauncherConfig,
        getJavaInfos,
      }}
    >
      <ColorModeScript initialColorMode={config.appearance.theme.colorMode} />
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
