import i18n from "i18next";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/toast";
import { LauncherConfig, defaultConfig } from "@/models/config";
import { ConfigService } from "@/services/config";

interface LauncherConfigContextType {
  config: LauncherConfig;
  setConfig: React.Dispatch<React.SetStateAction<LauncherConfig>>;
  update: (path: string, value: any) => void;
  fetchAll: () => void;
  restoreAll: () => void;
}

const LauncherConfigContext = createContext<
  LauncherConfigContextType | undefined
>(undefined);

export const LauncherConfigContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [config, setConfig] = useState<LauncherConfig>(defaultConfig);
  const { t } = useTranslation();
  const toast = useToast();

  const handleRetriveLauncherConfig = useCallback(() => {
    ConfigService.retriveLauncherConfig().then((response) => {
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
    handleRetriveLauncherConfig();
  }, [handleRetriveLauncherConfig]);

  useEffect(() => {
    i18n.changeLanguage(config.general.general.language);
  }, [config.general.general.language]);

  const updateByKeyPath = (obj: any, path: string, value: any): void => {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  };

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

  const handleRestoreLauncherConfig = () => {
    ConfigService.restoreLauncherConfig().then((response) => {
      if (response.status === "success") {
        setConfig(response.data);
        toast({
          title: response.message,
          status: "success",
        });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  };

  return (
    <LauncherConfigContext.Provider
      value={{
        config,
        setConfig,
        update: handleUpdateLauncherConfig,
        fetchAll: handleRetriveLauncherConfig,
        restoreAll: handleRestoreLauncherConfig,
      }}
    >
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
